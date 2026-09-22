import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { success } from '../utils/apiResponse';
import { ApiError } from '../utils/ApiError';
import * as trackService from '../services/trackService';

export const trackRecord = asyncHandler(async (req: Request, res: Response) => {
  const query = (req.params.id || req.query.q || req.query.trackingId || req.query.id) as string;

  if (!query || !query.trim()) {
    throw ApiError.badRequest('Tracking ID or Order Number is required');
  }

  const result = await trackService.lookupTrackingRecord(query.trim());

  if (!result) {
    throw ApiError.notFound(`No order or measurement ticket found matching "${query.trim()}". Please check your Tracking ID.`);
  }

  return success(res, result);
});
