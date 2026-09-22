import { Request } from 'express';
import { FilterQuery } from 'mongoose';
import { AuditLog, AuditLogDoc } from '../models/AuditLog';
import { serializeDoc } from '../utils/serialize';
import { parsePagination, searchRegex } from '../utils/helpers';
import { writeAudit } from '../utils/audit';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, AuditActionType, AuditEntityType } from '../constants/auditActions';
import { ApiError } from '../utils/ApiError';

export async function listAuditLogs(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: FilterQuery<AuditLogDoc> = {};
  if (query.severity && query.severity !== 'all') filter.severity = String(query.severity);
  if (query.actionType && query.actionType !== 'all') filter.actionType = String(query.actionType);
  if (query.actorRole && query.actorRole !== 'all') filter.actorRole = String(query.actorRole);
  if (query.startDate || query.endDate) {
    filter.timestamp = {};
    if (query.startDate) (filter.timestamp as Record<string, Date>).$gte = new Date(String(query.startDate));
    if (query.endDate) (filter.timestamp as Record<string, Date>).$lte = new Date(String(query.endDate));
  }
  if (query.search && String(query.search).trim()) {
    const rx = searchRegex(String(query.search));
    filter.$or = [{ description: rx }, { actorName: rx }, { entityId: rx }, { actionType: rx }, { ipAddress: rx }];
  }

  const [rows, total] = await Promise.all([
    AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return { data: rows.map((r) => serializeDoc(r)), meta: { total, page, limit } };
}

export async function auditStats() {
  const [total, infoCount, successCount, warningCount, criticalCount, superAdminActions] = await Promise.all([
    AuditLog.countDocuments(),
    AuditLog.countDocuments({ severity: 'INFO' }),
    AuditLog.countDocuments({ severity: 'SUCCESS' }),
    AuditLog.countDocuments({ severity: 'WARNING' }),
    AuditLog.countDocuments({ severity: 'CRITICAL' }),
    AuditLog.countDocuments({ actorRole: 'Super Admin' }),
  ]);
  return {
    total,
    infoCount,
    successCount,
    warningCount: warningCount + criticalCount,
    criticalCount,
    superAdminActions,
  };
}

export async function createAuditEntry(body: Record<string, unknown>, req: Request) {
  if (!AUDIT_ACTIONS.includes(body.actionType as AuditActionType)) {
    throw ApiError.badRequest('Invalid actionType');
  }
  if (!AUDIT_ENTITY_TYPES.includes(body.entityType as AuditEntityType)) {
    throw ApiError.badRequest('Invalid entityType');
  }
  await writeAudit({
    req,
    actionType: body.actionType as AuditActionType,
    entityType: body.entityType as AuditEntityType,
    entityId: String(body.entityId),
    description: String(body.description),
    details: body.details as Record<string, unknown>,
    severity: (body.severity as 'INFO') || 'INFO',
  });
  return { recorded: true };
}
