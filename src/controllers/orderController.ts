import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { success, created } from '../utils/apiResponse';
import * as orderService from '../services/orderService';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await orderService.listOrders(req.query as Record<string, unknown>);
  return success(res, result.data, undefined, 200, result.meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await orderService.getOrder(req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  return created(res, await orderService.createOrder(req.body, req), 'Order created');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await orderService.updateOrder(req.params.id, req.body, req), 'Order updated');
});

export const updateStage = asyncHandler(async (req: Request, res: Response) => {
  return success(res, await orderService.updateOrderStage(req.params.id, req.body, req), 'Stage updated');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await orderService.deleteOrder(req.params.id, req.body?.supervisorPin || req.body?.pin, req);
  return success(res, { deleted: true }, 'Order deleted');
});
