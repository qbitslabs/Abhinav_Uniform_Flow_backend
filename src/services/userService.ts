import bcrypt from 'bcryptjs';
import { Request } from 'express';
import { User, UserDoc } from '../models/User';
import { Worker } from '../models/Worker';
import { ApiError } from '../utils/ApiError';
import { nextUserId, nextWorkerId } from '../utils/idGenerator';
import { writeAudit } from '../utils/audit';
import { publicUser } from './authService';

const SALT = 10;

async function allocateUserCustomId(): Promise<string> {
  for (let i = 0; i < 80; i++) {
    const customId = await nextUserId();
    const exists = await User.exists({ customId });
    if (!exists) return customId;
  }
  throw ApiError.conflict('Could not allocate a unique user id');
}

function parseSalary(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) throw ApiError.badRequest('Monthly salary must be a non-negative number');
  return n;
}

/** Resolve Floor Admin → worker id (supports legacy linkedWorkerId). */
function getUserWorkerId(user: UserDoc): string | undefined {
  return user.workerId || user.linkedWorkerId;
}

function workerPhoneForUser(user: UserDoc): string {
  const phone = user.phone?.trim();
  return phone || user.username;
}

function workerBelongsToUser(worker: {
  userId?: string;
  linkedUserId?: string;
  phone?: string;
}, user: UserDoc): boolean {
  if (worker.userId === user.customId || worker.linkedUserId === user.customId) return true;
  // Legacy FA pay rows used username as phone before userId was set
  if (!worker.userId && !worker.linkedUserId && worker.phone === user.username) return true;
  if (!worker.userId && !worker.linkedUserId && user.phone && worker.phone === user.phone) return true;
  return false;
}

/**
 * Create/sync a Salaried Worker beside the Floor Admin.
 * - User.workerId = Worker.customId (WRK-…)
 * - Worker.userId = User.customId (USR-…)
 */
async function ensureFloorAdminWorker(user: UserDoc): Promise<string> {
  const existingWorkerId = getUserWorkerId(user);

  if (existingWorkerId) {
    const existing = await Worker.findOne({ customId: existingWorkerId });
    if (existing && workerBelongsToUser(existing, user)) {
      existing.name = user.name;
      existing.phone = workerPhoneForUser(user);
      existing.payType = 'Salaried';
      if (user.monthlySalary != null) existing.monthlySalary = user.monthlySalary;
      if (user.salaryStartDate) existing.salaryStartDate = user.salaryStartDate;
      existing.userId = user.customId;
      existing.set('linkedUserId', undefined);
      existing.isActive = user.isActive !== false;
      if (!existing.activities?.length) existing.activities = [];
      await existing.save();

      user.workerId = existing.customId;
      user.set('linkedWorkerId', undefined);
      await user.save();
      return existing.customId;
    }
    // Stale/wrong pointer — drop it and recreate below
    user.workerId = undefined;
    user.set('linkedWorkerId', undefined);
  }

  const byUser =
    (await Worker.findOne({ userId: user.customId })) ||
    (await Worker.findOne({ linkedUserId: user.customId }));

  if (byUser && workerBelongsToUser(byUser, user)) {
    byUser.name = user.name;
    byUser.phone = workerPhoneForUser(user);
    byUser.payType = 'Salaried';
    if (user.monthlySalary != null) byUser.monthlySalary = user.monthlySalary;
    if (user.salaryStartDate) byUser.salaryStartDate = user.salaryStartDate;
    byUser.userId = user.customId;
    byUser.set('linkedUserId', undefined);
    byUser.isActive = user.isActive !== false;
    await byUser.save();

    user.workerId = byUser.customId;
    user.set('linkedWorkerId', undefined);
    await user.save();
    return byUser.customId;
  }

  const customId = await nextWorkerId();
  const worker = await Worker.create({
    customId,
    name: user.name,
    phone: workerPhoneForUser(user),
    payType: 'Salaried',
    monthlySalary: user.monthlySalary,
    salaryStartDate: user.salaryStartDate,
    activities: [],
    userId: user.customId,
    isActive: user.isActive !== false,
  });

  user.workerId = worker.customId;
  user.set('linkedWorkerId', undefined);
  await user.save();
  return worker.customId;
}

export async function listUsers() {
  const rows = await User.find().sort({ role: -1, createdAt: 1 });
  for (const u of rows) {
    if (u.role !== 'Floor Admin') continue;
    const hasWorker = Boolean(getUserWorkerId(u));
    if (!hasWorker) {
      try {
        await ensureFloorAdminWorker(u);
      } catch {
        // ignore backfill failures so list still returns
      }
    } else {
      // Migrate legacy field names / keep pay worker in sync
      try {
        await ensureFloorAdminWorker(u);
      } catch {
        // ignore
      }
    }
  }
  const refreshed = await User.find().sort({ role: -1, createdAt: 1 });
  return refreshed.map((u) => publicUser(u));
}

export async function createFloorAdmin(
  body: {
    name: string;
    username: string;
    password: string;
    phone: string;
    email?: string;
    monthlySalary?: number;
    salaryStartDate: string;
  },
  req: Request
) {
  const username = body.username.trim().toLowerCase();
  const name = body.name.trim();
  const password = body.password.trim();
  const phone = String(body.phone || '').trim();
  const email = body.email?.trim().toLowerCase();
  const monthlySalary = parseSalary(body.monthlySalary);
  if (monthlySalary === undefined) {
    throw ApiError.badRequest('Monthly salary is required for Floor Admin');
  }
  const salaryStartDate = new Date(String(body.salaryStartDate));
  if (Number.isNaN(salaryStartDate.getTime())) {
    throw ApiError.badRequest('Salary start date (“starts from”) is required');
  }

  if (!name) throw ApiError.badRequest('Name is required');
  if (username.length < 3) throw ApiError.badRequest('Username must be at least 3 characters');
  if (password.length < 6) throw ApiError.badRequest('Password must be at least 6 characters');
  if (phone.length < 7) throw ApiError.badRequest('Phone number is required');

  const taken = await User.findOne({
    $or: [{ username }, ...(email ? [{ email }] : [])],
  });
  if (taken) {
    throw ApiError.badRequest(
      taken.username === username ? 'Username is already taken' : 'Email is already in use'
    );
  }

  const user = await User.create({
    customId: await allocateUserCustomId(),
    name,
    username,
    phone,
    email: email || undefined,
    password: await bcrypt.hash(password, SALT),
    role: 'Floor Admin',
    monthlySalary,
    salaryStartDate,
    isActive: true,
  });

  const workerId = await ensureFloorAdminWorker(user);

  const { runMonthlySalaryJob } = await import('../jobs/monthlySalaryJob.js');
  void runMonthlySalaryJob().catch(() => undefined);

  await writeAudit({
    req,
    actionType: 'USER_CREATED',
    entityType: 'Auth',
    entityId: user.customId,
    description: `Floor Admin account "${user.username}" created with pay worker ${workerId}`,
    details: {
      username: user.username,
      name: user.name,
      phone: user.phone,
      role: user.role,
      monthlySalary: user.monthlySalary,
      salaryStartDate: user.salaryStartDate,
      workerId,
      userId: user.customId,
    },
    severity: 'SUCCESS',
  });

  return publicUser(user);
}

export async function updateFloorAdmin(
  id: string,
  body: {
    name?: string;
    password?: string;
    phone?: string;
    email?: string;
    monthlySalary?: number | null;
    salaryStartDate?: string;
    isActive?: boolean;
  },
  req: Request
) {
  const user = await User.findOne({ customId: id });
  if (!user) throw ApiError.notFound('User not found');
  if (user.role !== 'Floor Admin') {
    throw ApiError.badRequest('Only Floor Admin accounts can be updated here');
  }

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) throw ApiError.badRequest('Name is required');
    user.name = name;
  }

  if (body.phone !== undefined) {
    const phone = String(body.phone).trim();
    if (phone.length < 7) throw ApiError.badRequest('Phone number is required');
    user.phone = phone;
  }

  if (body.salaryStartDate !== undefined) {
    const d = new Date(String(body.salaryStartDate));
    if (Number.isNaN(d.getTime())) throw ApiError.badRequest('Invalid salary start date.');
    user.salaryStartDate = d;
  }

  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (email) {
      const taken = await User.findOne({ email, customId: { $ne: id } });
      if (taken) throw ApiError.badRequest('Email is already in use');
      user.email = email;
    } else {
      user.email = undefined;
    }
  }

  if (body.password !== undefined && String(body.password).trim()) {
    const password = String(body.password).trim();
    if (password.length < 6) throw ApiError.badRequest('Password must be at least 6 characters');
    user.password = await bcrypt.hash(password, SALT);
  }

  if (body.monthlySalary !== undefined) {
    if (body.monthlySalary === null) {
      user.monthlySalary = undefined;
    } else {
      user.monthlySalary = parseSalary(body.monthlySalary);
    }
  }

  if (body.isActive !== undefined) {
    if (req.user?.id === user.customId && body.isActive === false) {
      throw ApiError.badRequest('You cannot deactivate your own account');
    }
    user.isActive = Boolean(body.isActive);
  }

  await user.save();
  await ensureFloorAdminWorker(user);

  const { runMonthlySalaryJob } = await import('../jobs/monthlySalaryJob.js');
  void runMonthlySalaryJob().catch(() => undefined);

  await writeAudit({
    req,
    actionType: 'USER_CREATED',
    entityType: 'Auth',
    entityId: user.customId,
    description: `Floor Admin "${user.username}" updated`,
    details: {
      username: user.username,
      name: user.name,
      monthlySalary: user.monthlySalary,
      workerId: user.workerId,
      userId: user.customId,
      isActive: user.isActive,
    },
    severity: 'INFO',
  });

  return publicUser(user);
}

export async function setFloorAdminActive(id: string, isActive: boolean, req: Request) {
  const user = await User.findOne({ customId: id });
  if (!user) throw ApiError.notFound('User not found');
  if (user.role !== 'Floor Admin') {
    throw ApiError.badRequest('Only Floor Admin accounts can be activated or deactivated here');
  }
  if (req.user?.id === user.customId) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }

  user.isActive = isActive;
  await user.save();
  await ensureFloorAdminWorker(user);

  await writeAudit({
    req,
    actionType: 'USER_CREATED',
    entityType: 'Auth',
    entityId: user.customId,
    description: `Floor Admin "${user.username}" ${isActive ? 'activated' : 'deactivated'}`,
    details: { username: user.username, isActive, workerId: user.workerId, userId: user.customId },
    severity: isActive ? 'INFO' : 'WARNING',
  });

  return publicUser(user);
}
