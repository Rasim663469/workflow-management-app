import type { Response, NextFunction } from 'express';

export function requireAdmin(req: Express.Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access restricted to admins' });
  }
  next();
}
