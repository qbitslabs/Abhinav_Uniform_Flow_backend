import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { success, created } from '../utils/apiResponse';
import * as ledgerService from '../services/ledgerService';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await ledgerService.listLedger(req.query as Record<string, unknown>);
  return success(res, result.data, undefined, 200, result.meta);
});

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const workerId = req.query.workerId as string | undefined;
  const result = await ledgerService.getLedgerSummary(workerId);
  return success(res, result);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const result = await ledgerService.createLedgerEntry(req.body, req);
  return created(res, result, 'Ledger transaction recorded');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const pin = req.body?.pin || req.body?.supervisorPin;
  const result = await ledgerService.deleteLedgerEntry(req.params.id, pin, req);
  return success(res, result, 'Ledger transaction removed');
});

export const exportExcel = asyncHandler(async (req: Request, res: Response) => {
  const workbook = await ledgerService.buildLedgerExcelWorkbook(req.query as Record<string, unknown>);
  const filename = `Worker_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
});
