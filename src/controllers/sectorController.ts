import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { success, created } from '../utils/apiResponse';
import * as sectorService from '../services/sectorService';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  return success(res, await sectorService.listSectors());
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  return created(res, await sectorService.createSector(req.body, req), 'Sector created');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await sectorService.updateSector(req.params.id, req.body, req), 'Sector updated');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await sectorService.deleteSector(req.params.id, req);
  return success(res, { deleted: true }, 'Sector deleted');
});

export const listClients = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await sectorService.listClients(req.query as Record<string, unknown>));
});

export const createClient = asyncHandler(async (req: Request, res: Response) => {
  return created(res, await sectorService.createClient(req.body, req), 'Client created');
});

export const updateClient = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await sectorService.updateClient(req.params.id, req.body, req), 'Client updated');
});

export const removeClient = asyncHandler(async (req: Request, res: Response) => {
  await sectorService.deleteClient(req.params.id, req);
  return success(res, { deleted: true }, 'Client deleted');
});
