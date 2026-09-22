import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { success, created } from '../utils/apiResponse';
import * as manufacturingService from '../services/manufacturingService';

export const list = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await manufacturingService.listTickets(req.query as Record<string, unknown>));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await manufacturingService.getTicket(req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  return created(res, await manufacturingService.createTicket(req.body, req), 'Manufacturing ticket generated');
});

export const updateStage = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await manufacturingService.updateTicketStage(req.params.id, req.body, req), 'Ticket stage updated');
});
