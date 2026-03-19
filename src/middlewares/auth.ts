import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AppError } from '../utils/errors';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Token de autenticação ausente'));
  }

  const token = authHeader.substring(7);

  try {
    const user = verifyToken(token);
    req.user = user;
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Token inválido ou expirado'));
  }
}
