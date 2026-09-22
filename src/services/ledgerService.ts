import { Request } from 'express';
import { FilterQuery } from 'mongoose';
import ExcelJS from 'exceljs';
import {
  WorkerLedger,
  WorkerLedgerDoc,
  LedgerTransactionType,
  LedgerEntryType,
  LedgerPaymentMode,
} from '../models/WorkerLedger';
import { Worker } from '../models/Worker';
import { ApiError } from '../utils/ApiError';
import { serializeDoc } from '../utils/serialize';
import { parsePagination, searchRegex, cleanText } from '../utils/helpers';
import { nextLedgerVoucherNumber } from '../utils/idGenerator';
import { writeAudit } from '../utils/audit';
import { findByPublicId, findByPublicIdOrThrow } from './lookup';
import { getSettingsDoc, maybeRequirePin } from '../utils/pin';
import { getPerPieceRateForActivity } from './workerService';

export async function listLedger(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: FilterQuery<WorkerLedgerDoc> = {};

  if (query.workerId && String(query.workerId) !== 'all') {
    filter.workerId = String(query.workerId);
  }

  if (query.transactionType && String(query.transactionType) !== 'all') {
    filter.transactionType = String(query.transactionType) as LedgerTransactionType;
  }

  if (query.entryType && String(query.entryType) !== 'all') {
    filter.entryType = String(query.entryType) as LedgerEntryType;
  }

  if (query.startDate || query.endDate) {
    filter.date = {};
    if (query.startDate) {
      filter.date.$gte = new Date(String(query.startDate));
    }
    if (query.endDate) {
      const end = new Date(String(query.endDate));
      end.setHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }

  if (query.search && String(query.search).trim()) {
    const rx = searchRegex(String(query.search));
    filter.$or = [
      { workerName: rx },
      { voucherNumber: rx },
      { referenceNumber: rx },
      { notes: rx },
      { garmentItemName: rx },
      { orderNumber: rx },
    ];
  }

  const [total, docs] = await Promise.all([
    WorkerLedger.countDocuments(filter),
    WorkerLedger.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit),
  ]);

  return {
    data: docs.map((d) => serializeDoc(d)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getLedgerSummary(workerId?: string) {
  const filter: FilterQuery<WorkerLedgerDoc> = {};
  if (workerId && workerId !== 'all') {
    filter.workerId = workerId;
  }

  const entries = await WorkerLedger.find(filter);

  let totalCredit = 0; // Earned (Piece-rate, Bonus)
  let totalDebit = 0; // Paid out (Advance, Wage payouts, Deductions)
  let totalAdvance = 0;
  let totalPieceRate = 0;
  let totalPayout = 0;
  let totalBonus = 0;
  let totalDeduction = 0;

  // Breakdown by worker
  const workerMap = new Map<
    string,
    {
      workerId: string;
      workerName: string;
      workerPhone: string;
      totalCredit: number;
      totalDebit: number;
      advancePaid: number;
      pieceRateEarned: number;
      wagePayouts: number;
      bonus: number;
      deduction: number;
      netBalance: number;
    }
  >();

  for (const entry of entries) {
    const amt = Number(entry.amount) || 0;

    if (!workerMap.has(entry.workerId)) {
      workerMap.set(entry.workerId, {
        workerId: entry.workerId,
        workerName: entry.workerName,
        workerPhone: entry.workerPhone || '—',
        totalCredit: 0,
        totalDebit: 0,
        advancePaid: 0,
        pieceRateEarned: 0,
        wagePayouts: 0,
        bonus: 0,
        deduction: 0,
        netBalance: 0,
      });
    }

    const w = workerMap.get(entry.workerId)!;

    if (entry.entryType === 'Credit') {
      totalCredit += amt;
      w.totalCredit += amt;
    } else {
      totalDebit += amt;
      w.totalDebit += amt;
    }

    switch (entry.transactionType) {
      case 'Advance Payment':
        totalAdvance += amt;
        w.advancePaid += amt;
        break;
      case 'Piece-Rate Earning':
        totalPieceRate += amt;
        w.pieceRateEarned += amt;
        break;
      case 'Wage Payout':
        totalPayout += amt;
        w.wagePayouts += amt;
        break;
      case 'Bonus':
      case 'Monthly Salary':
        totalBonus += amt;
        w.bonus += amt;
        break;
      case 'Deduction':
        totalDeduction += amt;
        w.deduction += amt;
        break;
    }
  }

  // Calculate net balances for each worker
  for (const w of workerMap.values()) {
    w.netBalance = w.totalCredit - w.totalDebit;
  }

  // Also include any active workers with 0 entries so supervisor sees full roster
  if (!workerId || workerId === 'all') {
    const allWorkers = await Worker.find({ isActive: true });
    for (const awk of allWorkers) {
      if (!workerMap.has(awk.customId)) {
        workerMap.set(awk.customId, {
          workerId: awk.customId,
          workerName: awk.name,
          workerPhone: awk.phone || '—',
          totalCredit: 0,
          totalDebit: 0,
          advancePaid: 0,
          pieceRateEarned: 0,
          wagePayouts: 0,
          bonus: 0,
          deduction: 0,
          netBalance: 0,
        });
      }
    }
  }

  const workerSummaries = Array.from(workerMap.values()).sort((a, b) => b.netBalance - a.netBalance);
  const netBalancePayable = totalCredit - totalDebit;

  return {
    totalCredit,
    totalDebit,
    totalAdvance,
    totalPieceRate,
    totalPayout,
    totalBonus,
    totalDeduction,
    netBalancePayable,
    transactionCount: entries.length,
    workers: workerSummaries,
  };
}

export async function createLedgerEntry(body: Record<string, unknown>, req: Request) {
  let worker = null;
  if (body.workerId) {
    worker = await findByPublicId(Worker, String(body.workerId), ['name']);
  }
  if (!worker && body.workerName) {
    worker = await Worker.findOne({ name: String(body.workerName).trim() });
  }

  const workerCustomId = worker?.customId || String(body.workerId || 'WRK-GEN');
  const workerName = worker?.name || String(body.workerName || 'Worker');
  const workerPhone = worker?.phone || (body.workerPhone ? String(body.workerPhone) : undefined);

  const transactionType = String(body.transactionType) as LedgerTransactionType;
  let entryType: LedgerEntryType = 'Debit';

  if (transactionType === 'Piece-Rate Earning' || transactionType === 'Bonus' || transactionType === 'Monthly Salary') {
    entryType = 'Credit';
  } else {
    // Advance Payment, Wage Payout, Deduction
    entryType = 'Debit';
  }

  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    throw ApiError.badRequest('Transaction amount must be greater than zero');
  }

  const { customId, voucherNumber } = await nextLedgerVoucherNumber();

  const doc = await WorkerLedger.create({
    customId,
    voucherNumber,
    workerId: workerCustomId,
    workerName,
    workerPhone,
    transactionType,
    entryType,
    amount,
    pieces: body.pieces ? Number(body.pieces) : undefined,
    ratePerPiece: body.ratePerPiece ? Number(body.ratePerPiece) : undefined,
    garmentItemName: cleanText(body.garmentItemName as string),
    orderNumber: cleanText(body.orderNumber as string),
    paymentMode: (body.paymentMode as LedgerPaymentMode) || 'Cash',
    referenceNumber: cleanText(body.referenceNumber as string),
    date: body.date ? new Date(String(body.date)) : new Date(),
    notes: cleanText(body.notes as string),
    recordedBy: req.user?.name || 'Supervisor',
  });

  await writeAudit({
    req,
    actionType: 'PAYROLL_CALCULATED',
    entityType: 'Payroll',
    entityId: workerCustomId,
    description: `Recorded ${transactionType} (${entryType} ₹${amount}) for ${workerName} [Voucher: ${voucherNumber}]`,
    details: { voucherNumber, transactionType, entryType, amount, paymentMode: body.paymentMode },
    severity: 'INFO',
  });

  return serializeDoc(doc);
}

/**
 * Auto-credit Piece-Rate Earning when a per-piece worker completes floor pieces.
 * Salaried workers are skipped. Rate comes from the worker's activity rate for this stage.
 */
export async function recordPieceRateFromTaskProgress(params: {
  workerId: string;
  stage: string;
  piecesDelta: number;
  garmentItemName?: string;
  orderNumber?: string;
  taskNumber?: string;
  req: Request;
}) {
  const { workerId, stage, piecesDelta, garmentItemName, orderNumber, taskNumber, req } = params;
  if (!piecesDelta || piecesDelta <= 0) return null;

  const worker =
    (await findByPublicId(Worker, workerId, ['name'])) ||
    (await Worker.findOne({ customId: workerId }));

  if (!worker || worker.payType !== 'Per Piece') {
    return null;
  }

  const rate = getPerPieceRateForActivity(worker, stage);
  if (rate === null) {
    return null;
  }

  // One auto credit per floor task — skip if already posted for this task number
  if (taskNumber) {
    const existing = await WorkerLedger.findOne({
      referenceNumber: String(taskNumber).trim(),
      transactionType: 'Piece-Rate Earning',
      workerId: worker.customId,
    });
    if (existing) return null;
  }

  const amount = Number((piecesDelta * rate).toFixed(2));
  if (amount <= 0) return null;

  const { customId, voucherNumber } = await nextLedgerVoucherNumber();
  const doc = await WorkerLedger.create({
    customId,
    voucherNumber,
    workerId: worker.customId,
    workerName: worker.name,
    workerPhone: worker.phone,
    transactionType: 'Piece-Rate Earning',
    entryType: 'Credit',
    amount,
    pieces: piecesDelta,
    ratePerPiece: rate,
    garmentItemName: cleanText(garmentItemName),
    orderNumber: cleanText(orderNumber),
    paymentMode: 'N/A',
    referenceNumber: taskNumber ? cleanText(taskNumber) : undefined,
    date: new Date(),
    notes: cleanText(
      `Auto (task completed): ${piecesDelta} pcs × ₹${rate}/${stage}${taskNumber ? ` · Task ${taskNumber}` : ''}`
    ),
    recordedBy: req.user?.name || 'System',
  });

  await writeAudit({
    req,
    actionType: 'PAYROLL_CALCULATED',
    entityType: 'Payroll',
    entityId: worker.customId,
    description: `Auto piece-rate credit ₹${amount} for ${worker.name} (${stage}, ${piecesDelta} pcs @ ₹${rate}) [Voucher: ${voucherNumber}]`,
    details: {
      voucherNumber,
      stage,
      pieces: piecesDelta,
      ratePerPiece: rate,
      amount,
      taskNumber,
      orderNumber,
    },
    severity: 'SUCCESS',
  });

  return serializeDoc(doc);
}

export async function deleteLedgerEntry(id: string, pin: string | undefined, req: Request) {
  const settings = await getSettingsDoc();
  await maybeRequirePin(pin, settings.requireAuthForDelete, req);

  const entry = await findByPublicIdOrThrow(WorkerLedger, id, 'Ledger Entry', ['voucherNumber']);
  const vid = entry.voucherNumber;
  const wname = entry.workerName;
  const amt = entry.amount;

  await entry.deleteOne();

  await writeAudit({
    req,
    actionType: 'PAYROLL_CALCULATED',
    entityType: 'Payroll',
    entityId: entry.workerId,
    description: `Deleted ledger voucher ${vid} (${wname} - ₹${amt})`,
    severity: 'WARNING',
  });

  return { deleted: true, voucherNumber: vid };
}

export async function buildLedgerExcelWorkbook(query: Record<string, unknown>) {
  const filter: FilterQuery<WorkerLedgerDoc> = {};
  if (query.workerId && String(query.workerId) !== 'all') {
    filter.workerId = String(query.workerId);
  }
  if (query.transactionType && String(query.transactionType) !== 'all') {
    filter.transactionType = String(query.transactionType) as LedgerTransactionType;
  }

  const entries = await WorkerLedger.find(filter).sort({ date: -1, createdAt: -1 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Worker Ledger');

  sheet.columns = [
    { header: 'Voucher No', key: 'voucher', width: 18 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Worker Name', key: 'workerName', width: 22 },
    { header: 'Worker Phone', key: 'phone', width: 16 },
    { header: 'Transaction Type', key: 'txnType', width: 22 },
    { header: 'Entry Type', key: 'entryType', width: 12 },
    { header: 'Worker Earnings (₹)', key: 'credit', width: 18 },
    { header: 'Worker Payment (₹)', key: 'debit', width: 18 },
    { header: 'Pieces', key: 'pieces', width: 10 },
    { header: 'Rate/Pc (₹)', key: 'rate', width: 12 },
    { header: 'Garment / Item', key: 'garment', width: 20 },
    { header: 'Payment Mode', key: 'mode', width: 14 },
    { header: 'Reference / UTR', key: 'ref', width: 20 },
    { header: 'Notes / Description', key: 'notes', width: 30 },
    { header: 'Recorded By', key: 'recordedBy', width: 16 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E7FF' },
  };

  for (const e of entries) {
    sheet.addRow({
      voucher: e.voucherNumber,
      date: new Date(e.date).toISOString().split('T')[0],
      workerName: e.workerName,
      phone: e.workerPhone || '—',
      txnType: e.transactionType,
      entryType: e.entryType,
      credit: e.entryType === 'Credit' ? e.amount : 0,
      debit: e.entryType === 'Debit' ? e.amount : 0,
      pieces: e.pieces || '—',
      rate: e.ratePerPiece || '—',
      garment: e.garmentItemName || '—',
      mode: e.paymentMode,
      ref: e.referenceNumber || '—',
      notes: e.notes || '—',
      recordedBy: e.recordedBy || 'Supervisor',
    });
  }

  return workbook;
}
