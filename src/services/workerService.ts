import { Request } from 'express';
import { FilterQuery } from 'mongoose';
import { Worker, WorkerDoc, WorkerActivityRate, WorkerPayType } from '../models/Worker';
import { isFloorStage } from '../constants/stages';
import { serializeDoc } from '../utils/serialize';
import { searchRegex } from '../utils/helpers';
import { nextWorkerId } from '../utils/idGenerator';
import { writeAudit } from '../utils/audit';
import { findByPublicIdOrThrow } from './lookup';
import { getSettingsDoc, maybeRequirePin } from '../utils/pin';
import { ApiError } from '../utils/ApiError';

function normalizeActivities(
  payType: WorkerPayType,
  raw: unknown
): WorkerActivityRate[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const activities: WorkerActivityRate[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const activity = String((item as { activity?: string }).activity || '');
    if (!isFloorStage(activity) || seen.has(activity)) continue;
    seen.add(activity);

    const rateRaw = (item as { ratePerPiece?: number | string }).ratePerPiece;
    const ratePerPiece =
      rateRaw === undefined || rateRaw === null || rateRaw === ''
        ? undefined
        : Number(rateRaw);

    if (payType === 'Per Piece') {
      if (ratePerPiece === undefined || Number.isNaN(ratePerPiece) || ratePerPiece < 0) {
        throw ApiError.badRequest(
          `Per-piece rate is required for activity "${activity}" (₹ per piece).`
        );
      }
      activities.push({ activity, ratePerPiece });
    } else {
      activities.push({
        activity,
        ...(ratePerPiece !== undefined && !Number.isNaN(ratePerPiece)
          ? { ratePerPiece }
          : {}),
      });
    }
  }

  return activities;
}

export async function listWorkers(query: Record<string, unknown>) {
  const filter: FilterQuery<WorkerDoc> = {};
  if (query.isActive === 'true') filter.isActive = true;
  if (query.isActive === 'false') filter.isActive = false;
  if (query.payType === 'Salaried' || query.payType === 'Per Piece') {
    filter.payType = query.payType;
  }
  if (query.activity && isFloorStage(String(query.activity))) {
    filter['activities.activity'] = String(query.activity);
  }
  if (query.search && String(query.search).trim()) {
    const rx = searchRegex(String(query.search));
    filter.$or = [{ name: rx }, { phone: rx }, { customId: rx }];
  }
  const rows = await Worker.find(filter).sort({ customId: 1 });
  return rows.map((r) => {
    const out = serializeDoc(r) as Record<string, unknown>;
    if (!out.userId && out.linkedUserId) out.userId = out.linkedUserId;
    delete out.linkedUserId;
    return out;
  });
}

export async function getWorker(id: string) {
  const worker = await findByPublicIdOrThrow(Worker, id, 'Worker');
  // Normalize legacy linkedUserId → userId for API clients
  if (!worker.userId && worker.linkedUserId) {
    worker.userId = worker.linkedUserId;
    worker.linkedUserId = undefined;
    await worker.save();
  }
  const out = serializeDoc(worker) as Record<string, unknown>;
  if (!out.userId && out.linkedUserId) out.userId = out.linkedUserId;
  delete out.linkedUserId;
  return out;
}

export async function createWorker(body: Record<string, unknown>, req: Request) {
  const payType: WorkerPayType =
    body.payType === 'Salaried' ? 'Salaried' : 'Per Piece';
  const activities = normalizeActivities(payType, body.activities);

  if (payType === 'Salaried' && activities.length === 0) {
    throw ApiError.badRequest('Select at least one work activity for a salaried worker.');
  }
  if (payType === 'Per Piece' && activities.length === 0) {
    throw ApiError.badRequest('Add at least one per-piece activity with rate.');
  }

  const monthlySalary =
    payType === 'Salaried' && body.monthlySalary !== undefined && body.monthlySalary !== null
      ? Number(body.monthlySalary)
      : undefined;

  if (payType === 'Salaried' && (monthlySalary === undefined || Number.isNaN(monthlySalary) || monthlySalary < 0)) {
    throw ApiError.badRequest('Monthly salary amount is required for salaried workers.');
  }

  let salaryStartDate: Date | undefined;
  if (payType === 'Salaried') {
    const raw = body.salaryStartDate;
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      throw ApiError.badRequest('Salary start date (“starts from”) is required for salaried workers.');
    }
    salaryStartDate = new Date(String(raw));
    if (Number.isNaN(salaryStartDate.getTime())) {
      throw ApiError.badRequest('Invalid salary start date.');
    }
  }

  const customId = await nextWorkerId();
  const worker = await Worker.create({
    customId,
    name: String(body.name).trim(),
    phone: String(body.phone).trim(),
    payType,
    monthlySalary: payType === 'Salaried' ? monthlySalary : undefined,
    salaryStartDate: payType === 'Salaried' ? salaryStartDate : undefined,
    activities,
    isActive: true,
  });
  await writeAudit({
    req,
    actionType: 'WORKER_UPDATED',
    entityType: 'MasterData',
    entityId: worker.customId,
    description: `Created floor worker ${worker.name} (${worker.customId}) · ${worker.payType}`,
    severity: 'SUCCESS',
  });

  if (payType === 'Salaried') {
    const { runMonthlySalaryJob } = await import('../jobs/monthlySalaryJob.js');
    void runMonthlySalaryJob().catch(() => undefined);
  }

  return serializeDoc(worker);
}

export async function updateWorker(id: string, body: Record<string, unknown>, req: Request) {
  const settings = await getSettingsDoc();
  await maybeRequirePin((body.supervisorPin || body.pin) as string | undefined, settings.requireAuthForEdit, req);
  const worker = await findByPublicIdOrThrow(Worker, id, 'Worker');

  if (body.name) worker.name = String(body.name).trim();
  if (body.phone) worker.phone = String(body.phone).trim();
  if (body.isActive !== undefined) worker.isActive = Boolean(body.isActive);

  if (body.payType === 'Salaried' || body.payType === 'Per Piece') {
    worker.payType = body.payType;
  }

  if (body.activities !== undefined) {
    worker.activities = normalizeActivities(worker.payType, body.activities);
  }

  if (worker.payType === 'Salaried') {
    if (body.monthlySalary !== undefined && body.monthlySalary !== null) {
      worker.monthlySalary = Number(body.monthlySalary);
    }
    if (worker.monthlySalary === undefined || Number.isNaN(worker.monthlySalary) || worker.monthlySalary < 0) {
      throw ApiError.badRequest('Monthly salary amount is required for salaried workers.');
    }
    if (body.salaryStartDate !== undefined) {
      if (body.salaryStartDate === null || String(body.salaryStartDate).trim() === '') {
        throw ApiError.badRequest('Salary start date (“starts from”) is required for salaried workers.');
      }
      const d = new Date(String(body.salaryStartDate));
      if (Number.isNaN(d.getTime())) throw ApiError.badRequest('Invalid salary start date.');
      worker.salaryStartDate = d;
    }
    if (!worker.salaryStartDate) {
      throw ApiError.badRequest('Salary start date (“starts from”) is required for salaried workers.');
    }
    if (!worker.activities.length) {
      throw ApiError.badRequest('Select at least one work activity for a salaried worker.');
    }
  } else {
    worker.monthlySalary = undefined;
    worker.salaryStartDate = undefined;
    if (!worker.activities.length) {
      throw ApiError.badRequest('Add at least one per-piece activity with rate.');
    }
  }

  await worker.save();
  await writeAudit({
    req,
    actionType: 'WORKER_UPDATED',
    entityType: 'MasterData',
    entityId: worker.customId,
    description: `Updated worker ${worker.name} (${worker.customId}) · ${worker.payType}`,
    severity: 'INFO',
  });

  if (worker.payType === 'Salaried') {
    const { runMonthlySalaryJob } = await import('../jobs/monthlySalaryJob.js');
    void runMonthlySalaryJob().catch(() => undefined);
  }

  return serializeDoc(worker);
}

export async function deleteWorker(id: string, pin: string | undefined, req: Request) {
  const settings = await getSettingsDoc();
  await maybeRequirePin(pin, settings.requireAuthForDelete, req);
  const worker = await findByPublicIdOrThrow(Worker, id, 'Worker');
  worker.isActive = false;
  await worker.save();
  await writeAudit({
    req,
    actionType: 'WORKER_UPDATED',
    entityType: 'MasterData',
    entityId: worker.customId,
    description: `Deactivated worker ${worker.name} (${worker.customId})`,
    severity: 'WARNING',
  });
  return serializeDoc(worker);
}

/** Resolve per-piece rate for a worker + floor activity, if eligible. */
export function getPerPieceRateForActivity(
  worker: WorkerDoc | null | undefined,
  stage: string
): number | null {
  if (!worker || worker.payType !== 'Per Piece') return null;
  if (!isFloorStage(stage)) return null;
  const match = worker.activities?.find((a) => a.activity === stage);
  if (!match || match.ratePerPiece === undefined || match.ratePerPiece === null) return null;
  const rate = Number(match.ratePerPiece);
  if (Number.isNaN(rate) || rate < 0) return null;
  return rate;
}
