import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logAccessDenied } from '../services/logging.service';

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Não autenticado'));
    }

    if (!roles.includes(req.user.role)) {
      // Log access denied event
      logAccessDenied({
        userId: req.user.id,
        role: req.user.role,
        endpoint: req.path,
        method: req.method,
        timestamp: new Date(),
        ip: req.ip || req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent'],
      });

      return next(new AppError(403, 'FORBIDDEN', 'Sem permissão para este recurso'));
    }

    next();
  };
}
