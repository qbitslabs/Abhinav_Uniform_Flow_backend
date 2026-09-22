import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { success, created } from '../utils/apiResponse';
import * as productionTaskService from '../services/productionTaskService';

export const list = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await productionTaskService.listTasks(req.query as Record<string, unknown>));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await productionTaskService.getTask(req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  return created(res, await productionTaskService.createTask(req.body, req), 'Task assigned');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await productionTaskService.updateTask(req.params.id, req.body, req), 'Task updated');
});

export const progress = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await productionTaskService.updateTaskProgress(req.params.id, req.body, req), 'Progress updated');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await productionTaskService.deleteTask(req.params.id, req.body?.supervisorPin || req.body?.pin, req);
  return success(res, { deleted: true }, 'Task deleted');
});
