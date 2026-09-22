import { Request } from 'express';
import { AuditLog } from '../models/AuditLog';
import { nextAuditId } from './idGenerator';
import { AuditActionType, AuditEntityType, AuditSeverity } from '../constants/auditActions';
import { AuthUser } from '../types/auth';
import { logger } from './logger';

export function clientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress;
}

export async function writeAudit(params: {
  req?: Request;
  actor?: AuthUser | { id: string; name: string; role: 'Super Admin' | 'Floor Admin' | 'System' };
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId: string;
  description: string;
  details?: Record<string, unknown>;
  severity?: AuditSeverity;
  ipAddress?: string;
}) {
  try {
    const actor = params.actor || params.req?.user;
    const customId = await nextAuditId();
    await AuditLog.create({
      customId,
      timestamp: new Date(),
      actorId: actor?.id || 'SYSTEM',
      actorName: actor?.name || 'System',
      actorRole: (actor?.role as 'Super Admin' | 'Floor Admin' | 'System') || 'System',
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId,
      description: params.description,
      details: params.details,
      ipAddress: params.ipAddress || (params.req ? clientIp(params.req) : undefined),
      severity: params.severity || 'INFO',
    });
  } catch (err) {
    logger.error('Failed to write audit log', err);
  }
}
