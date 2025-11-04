import jwt from 'jsonwebtoken';
import type { Response, NextFunction } from 'express';
import type { TokenPayload } from '../types/token-payload.js';
import { JWT_SECRET, JWT_EXPIRATION, REFRESH_EXPIRATION } from '../config/env.js';

export function createAccessToken(user: TokenPayload) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}

export function createRefreshToken(user: TokenPayload) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: REFRESH_EXPIRATION });
}

export function verifyToken(req: Express.Request, res: Response, next: NextFunction) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ error: 'Token missing' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as TokenPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}
