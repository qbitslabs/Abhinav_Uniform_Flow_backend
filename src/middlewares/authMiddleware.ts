import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User';
import { TokenBlacklist } from '../models/TokenBlacklist';
import { AuthUser } from '../types/auth';
import { UserRole, normalizeUserRole } from '../constants/stages';
import { asyncHandler } from '../utils/asyncHandler';

export interface JwtPayload {
  sub: string;
  customId: string;
  username: string;
  role: UserRole;
}

export function signToken(user: { id: string; customId: string; username: string; role: UserRole }): string {
  return jwt.sign(
    {
      sub: user.id,
      customId: user.customId,
      username: user.username,
      role: user.role,
    } satisfies JwtPayload,
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
  );
}

export function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractBearer(req);
  if (!token) throw ApiError.unauthorized('Missing or invalid Authorization header');

  const revoked = await TokenBlacklist.findOne({ token });
  if (revoked) throw ApiError.unauthorized('Session has been revoked. Please log in again.');

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('User is inactive or no longer exists');

  const authUser: AuthUser = {
    id: user.customId,
    customId: user.customId,
    name: user.name,
    username: user.username,
    role: normalizeUserRole(user.role),
    email: user.email,
  };
  req.user = authUser;
  (req as Request & { token?: string }).token = token;
  next();
});

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  if (!extractBearer(req)) return next();
  return authenticate(req, res, next);
}
