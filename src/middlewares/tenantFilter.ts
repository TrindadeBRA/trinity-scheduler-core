import { Request, Response, NextFunction } from 'express';

export function tenantFilter(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    return next();
  }

  const shopId = req.user.shopId;

  // Para GET, injeta no query
  if (req.method === 'GET') {
    req.query.shopId = shopId;
  }

  // Para POST/PUT/PATCH, injeta no body (apenas se for objeto, não array)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && !Array.isArray(req.body)) {
    req.body = { ...req.body, shopId };
  }

  // Injeta no req para uso direto nos handlers
  req.shopId = shopId;

  next();
}
