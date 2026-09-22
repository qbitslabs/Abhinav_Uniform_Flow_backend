import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { success, created } from '../utils/apiResponse';
import * as measurementService from '../services/measurementService';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await measurementService.listMeasurements(req.query as Record<string, unknown>);
  return success(res, result.data, undefined, 200, result.meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await measurementService.getMeasurement(req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  return created(res, await measurementService.createMeasurement(req.body, req), 'Measurement recorded');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await measurementService.updateMeasurement(req.params.id, req.body, req), 'Measurement updated');
});

export const batchAssign = asyncHandler(async (req: Request, res: Response) => {
  const data = await measurementService.batchAssign(req.body.measurementIds, req.body.workerNames, req);
  return success(res, data, 'Workers assigned');
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await measurementService.updateMeasurementStatus(req.params.id, req.body.status, req));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await measurementService.deleteMeasurement(req.params.id, req.body?.supervisorPin || req.body?.pin, req);
  return success(res, { deleted: true }, 'Measurement deleted');
});
