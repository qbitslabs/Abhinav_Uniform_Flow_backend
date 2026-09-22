import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { User } from '../models/User';
import { TokenBlacklist } from '../models/TokenBlacklist';
import { ApiError } from '../utils/ApiError';
import { signToken, extractBearer } from '../middlewares/authMiddleware';
import { writeAudit } from '../utils/audit';
import { serializeDoc } from '../utils/serialize';
import { verifyPin, PinType } from '../utils/pin';
import { normalizeUserRole } from '../constants/stages';

const SALT = 10;

export function publicUser(user: {
  customId: string;
  name: string;
  username: string;
  role: string;
  email?: string;
  phone?: string;
  monthlySalary?: number;
  salaryStartDate?: Date | string;
  workerId?: string;
  linkedWorkerId?: string;
  isActive?: boolean;
}) {
  return {
    id: user.customId,
    name: user.name,
    username: user.username,
    role: normalizeUserRole(user.role),
    email: user.email,
    phone: user.phone,
    monthlySalary: user.monthlySalary,
    salaryStartDate: user.salaryStartDate
      ? new Date(user.salaryStartDate).toISOString().slice(0, 10)
      : undefined,
    workerId: user.workerId || user.linkedWorkerId,
    isActive: user.isActive !== false,
  };
}

export async function login(username: string, password: string, req: Request) {
  const user = await User.findOne({ username: username.trim().toLowerCase() }).select('+password');
  if (!user || !user.isActive) {
    await writeAudit({
      req,
      actor: { id: 'anonymous', name: username, role: 'System' },
      actionType: 'SECURITY_ALERT',
      entityType: 'Auth',
      entityId: username,
      description: `Failed login attempt for username "${username}"`,
      severity: 'WARNING',
    });
    throw ApiError.unauthorized('Invalid username or password');
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    await writeAudit({
      req,
      actor: { id: user.customId, name: user.name, role: normalizeUserRole(user.role) },
      actionType: 'SECURITY_ALERT',
      entityType: 'Auth',
      entityId: user.customId,
      description: `Failed login attempt for user ${user.username}`,
      severity: 'WARNING',
    });
    throw ApiError.unauthorized('Invalid username or password');
  }

  user.lastLogin = new Date();
  await user.save();

  const token = signToken({
    id: String(user._id),
    customId: user.customId,
    username: user.username,
    role: normalizeUserRole(user.role),
  });

  await writeAudit({
    req,
    actor: { id: user.customId, name: user.name, role: normalizeUserRole(user.role) },
    actionType: 'AUTH_LOGIN',
    entityType: 'Auth',
    entityId: user.customId,
    description: `${user.role} authenticated successfully`,
    severity: 'INFO',
  });

  return { token, user: publicUser(user) };
}

export async function logout(req: Request) {
  const token = extractBearer(req);
  if (token) {
    try {
      const decoded = jwt.decode(token) as { exp?: number } | null;
      const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 3600 * 1000);
      await TokenBlacklist.create({ token, expiresAt });
    } catch {
      /* ignore malformed tokens on logout */
    }
  }
  if (req.user) {
    await writeAudit({
      req,
      actor: req.user,
      actionType: 'AUTH_LOGOUT',
      entityType: 'Auth',
      entityId: req.user.id,
      description: `${req.user.role} logged out`,
      severity: 'INFO',
    });
  }
}

export async function verifySecurityPin(pin: string, type: PinType = 'supervisor', req: Request) {
  const ok = await verifyPin(pin, type);
  if (!ok) {
    await writeAudit({
      req,
      actor: req.user || { id: 'anonymous', name: 'Unknown', role: 'System' },
      actionType: 'SECURITY_ALERT',
      entityType: 'Auth',
      entityId: req.user?.id || 'anonymous',
      description: `Failed ${type} PIN verification`,
      severity: 'WARNING',
    });
    throw ApiError.forbidden('Invalid PIN or password');
  }
  return { valid: true, type };
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, SALT);
}

export { serializeDoc };
