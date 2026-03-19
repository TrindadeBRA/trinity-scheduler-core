import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { Prisma } from '@prisma/client';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'CONFLICT', message: 'Registro duplicado' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Recurso não encontrado' });
      return;
    }
  }

  console.error(err);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'Erro interno do servidor',
  });
}
