import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { HttpError, sha256, randomToken, clientMeta } from '../utils/helpers';
import { repo } from '../db/connection';
import { User, UserSession } from '../db/entities';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  fullName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signAccessToken(u: AuthUser): string {
  return jwt.sign(u, config.jwtAccessSecret, { expiresIn: config.accessTokenTtl as SignOptions['expiresIn'] });
}

/** Create a refresh-token session row and return both tokens */
export async function issueSession(user: User, req: Request): Promise<{ accessToken: string; refreshToken: string }> {
  const refreshToken = randomToken(48);
  const meta = clientMeta(req);
  const session = repo(UserSession).create({
    userId: user.id,
    refreshTokenHash: sha256(refreshToken),
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
    expiresAt: new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
  });
  await repo(UserSession).save(session);
  return {
    accessToken: signAccessToken({ id: user.id, email: user.email, role: user.role, fullName: user.fullName }),
    refreshToken,
  };
}

export function verifyAccessToken(token: string): AuthUser {
  return jwt.verify(token, config.jwtAccessSecret) as AuthUser;
}

export const authRequired = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new HttpError(401, 'Session expired. Please login again.'));
  }
};

export const authOptional = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      req.user = verifyAccessToken(token);
    } catch {
      /* ignore invalid token for optional routes */
    }
  }
  next();
};

export const adminRequired = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) return next(new HttpError(401, 'Authentication required'));
  if (req.user.role !== 'admin') return next(new HttpError(403, 'Admin access required'));
  next();
};
