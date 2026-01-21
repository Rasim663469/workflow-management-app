import type { Response, NextFunction } from 'express';

const SUPER_ADMIN = 'super_admin';
const ALLOWED_ROLES = new Set([
  'super_admin',
  'super_organisateur',
  'organisateur',
  'benevole',
]);

function isAllowed(role: string, roles: string[]): boolean {
  if (!ALLOWED_ROLES.has(role)) return false;
  if (role === SUPER_ADMIN) return true;
  return roles.includes(role);
}

export function requireRoles(roles: string[]) {
  return (req: Express.Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || !isAllowed(role, roles)) {
      return res.status(403).json({ error: 'Accès non autorisé pour ce rôle' });
    }
    next();
  };
}

export function requireAdmin(req: Express.Request, res: Response, next: NextFunction) {
  return requireRoles([SUPER_ADMIN])(req, res, next);
}
