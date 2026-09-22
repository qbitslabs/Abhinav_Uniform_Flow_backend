import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { success } from '../utils/apiResponse';
import * as dashboardService from '../services/dashboardService';

export const stats = asyncHandler(async (_req: Request, res: Response) => {
  return success(res, await dashboardService.dashboardStats());
});
