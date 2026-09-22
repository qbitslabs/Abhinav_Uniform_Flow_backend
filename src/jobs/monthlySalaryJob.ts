import { Worker } from '../models/Worker';
import { WorkerLedger } from '../models/WorkerLedger';
import { nextLedgerVoucherNumber } from '../utils/idGenerator';
import { logger } from '../utils/logger';

/** Normalize to local calendar date at noon (avoids DST edge flips). */
export function toSalaryDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

/** Add calendar months keeping day-of-month when possible (31 Jan → 28/29 Feb). */
export function addCalendarMonths(base: Date, months: number): Date {
  const day = base.getDate();
  const result = new Date(base.getFullYear(), base.getMonth() + months, 1, 12, 0, 0, 0);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

export function salaryDueDatesThroughToday(salaryStartDate: Date, today = new Date()): Date[] {
  const start = toSalaryDay(salaryStartDate);
  const end = toSalaryDay(today);
  const due: Date[] = [];
  // First salary = start + 1 month (joined 22/09 → first 22/10)
  let cursor = addCalendarMonths(start, 1);
  let guard = 0;
  while (cursor.getTime() <= end.getTime() && guard < 600) {
    due.push(new Date(cursor));
    cursor = addCalendarMonths(cursor, 1);
    guard += 1;
  }
  return due;
}

function salaryRef(workerId: string, due: Date): string {
  const y = due.getFullYear();
  const m = String(due.getMonth() + 1).padStart(2, '0');
  const d = String(due.getDate()).padStart(2, '0');
  return `SAL-${workerId}-${y}-${m}-${d}`;
}

/**
 * Post missing Monthly Salary credits for all active Salaried workers
 * (including Floor Admin linked pay workers).
 */
export async function runMonthlySalaryJob(): Promise<{ posted: number; skipped: number }> {
  const today = toSalaryDay(new Date());
  const workers = await Worker.find({
    payType: 'Salaried',
    isActive: true,
    monthlySalary: { $gt: 0 },
  });

  let posted = 0;
  let skipped = 0;

  for (const worker of workers) {
    if (!worker.salaryStartDate || worker.monthlySalary == null || worker.monthlySalary <= 0) {
      skipped += 1;
      continue;
    }

    const dues = salaryDueDatesThroughToday(worker.salaryStartDate, today);
    for (const due of dues) {
      const referenceNumber = salaryRef(worker.customId, due);
      const existing = await WorkerLedger.findOne({
        workerId: worker.customId,
        transactionType: 'Monthly Salary',
        referenceNumber,
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const { customId, voucherNumber } = await nextLedgerVoucherNumber();
      const amount = Number(worker.monthlySalary);
      await WorkerLedger.create({
        customId,
        voucherNumber,
        workerId: worker.customId,
        workerName: worker.name,
        workerPhone: worker.phone,
        transactionType: 'Monthly Salary',
        entryType: 'Credit',
        amount,
        paymentMode: 'N/A',
        referenceNumber,
        date: due,
        notes: `Auto monthly salary for period starting ${toSalaryDay(worker.salaryStartDate!).toLocaleDateString('en-IN')} · due ${due.toLocaleDateString('en-IN')}`,
        recordedBy: 'System',
      });
      posted += 1;
      logger.info(
        `Monthly salary posted ${voucherNumber} ₹${amount} → ${worker.name} (${worker.customId}) due ${due.toISOString().slice(0, 10)}`
      );
    }
  }

  if (posted > 0 || workers.length > 0) {
    logger.info(`Monthly salary job finished: posted=${posted}, skipped=${skipped}, workers=${workers.length}`);
  }

  return { posted, skipped };
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/** Start interval job (also runs once shortly after boot). */
export function startMonthlySalaryJob(): void {
  const kick = () => {
    runMonthlySalaryJob().catch((err) => logger.error('Monthly salary job failed', err));
  };

  // Delay first run so DB is ready / server settled
  setTimeout(kick, 15_000);
  setInterval(kick, SIX_HOURS_MS);
  logger.info('Monthly salary job scheduled (every 6h + startup)');
}
