import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { success, created } from '../utils/apiResponse';
import * as uniformItemService from '../services/uniformItemService';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  return success(res, await uniformItemService.listItems());
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  return created(res, await uniformItemService.createItem(req.body, req), 'Garment created');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await uniformItemService.updateItem(req.params.id, req.body, req), 'Garment updated');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await uniformItemService.deleteItem(req.params.id, req.body?.supervisorPin || req.body?.pin, req);
  return success(res, { deleted: true }, 'Garment deleted');
});
