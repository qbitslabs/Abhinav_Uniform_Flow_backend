import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { success, created } from '../utils/apiResponse';
import * as auditLogService from '../services/auditLogService';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await auditLogService.listAuditLogs(req.query as Record<string, unknown>);
  return success(res, result.data, undefined, 200, result.meta);
});

export const stats = asyncHandler(async (_req: Request, res: Response) => {
  return success(res, await auditLogService.auditStats());
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  return created(res, await auditLogService.createAuditEntry(req.body, req), 'Audit entry recorded');
});
