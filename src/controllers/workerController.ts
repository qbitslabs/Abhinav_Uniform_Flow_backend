import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { success, created } from '../utils/apiResponse';
import * as workerService from '../services/workerService';

export const list = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await workerService.listWorkers(req.query as Record<string, unknown>));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await workerService.getWorker(req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  return created(res, await workerService.createWorker(req.body, req), 'Worker created');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await workerService.updateWorker(req.params.id, req.body, req), 'Worker updated');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  return success(
    res,
    await workerService.deleteWorker(req.params.id, req.body?.supervisorPin || req.body?.pin, req),
    'Worker deactivated'
  );
});
