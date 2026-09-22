import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { success } from '../utils/apiResponse';
import * as userService from '../services/userService';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  return success(res, await userService.listUsers());
});

export const createFloorAdmin = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await userService.createFloorAdmin(req.body, req), 'Floor Admin created');
});

export const updateFloorAdmin = asyncHandler(async (req: Request, res: Response) => {
  return success(
    res,
    await userService.updateFloorAdmin(req.params.id, req.body, req),
    'Floor Admin updated'
  );
});

export const setActive = asyncHandler(async (req: Request, res: Response) => {
  return success(
    res,
    await userService.setFloorAdminActive(req.params.id, Boolean(req.body.isActive), req),
    req.body.isActive ? 'Floor Admin activated' : 'Floor Admin deactivated'
  );
});
