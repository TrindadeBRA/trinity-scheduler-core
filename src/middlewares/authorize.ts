import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Não autenticado'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Sem permissão para este recurso'));
    }

    next();
  };
}
