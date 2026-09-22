import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { success } from '../utils/apiResponse';
import * as authService from '../services/authService';
import { PinType } from '../utils/pin';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body.username, req.body.password, req);
  return success(res, result, 'Login successful');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  return success(res, req.user);
});

export const verifyPin = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.verifySecurityPin(req.body.pin, (req.body.type as PinType) || 'supervisor', req);
  return success(res, result, 'PIN verified');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req);
  return success(res, { loggedOut: true }, 'Logged out');
});
