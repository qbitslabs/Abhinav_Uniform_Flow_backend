import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { success } from '../utils/apiResponse';
import * as settingsService from '../services/settingsService';

export const get = asyncHandler(async (_req: Request, res: Response) => {
  return success(res, await settingsService.getSettings());
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await settingsService.updateSettings(req.body, req), 'Settings updated');
});

export const resetDemo = asyncHandler(async (req: Request, res: Response) => {
  return success(
    res,
    await settingsService.resetDemo(req, req.body || {}),
    'Operational data cleared; master data and users kept'
  );
});

export const backup = asyncHandler(async (_req: Request, res: Response) => {
  const data = await settingsService.exportBackup();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Abhinav_ERP_Full_Backup_${new Date().toISOString().split('T')[0]}.json"`
  );
  return res.send(JSON.stringify(data, null, 2));
});
