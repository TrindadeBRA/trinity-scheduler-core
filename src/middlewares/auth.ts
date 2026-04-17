import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AppError } from '../utils/errors';
import { prisma } from '../utils/prisma';

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Token de autenticação ausente'));
  }

  const token = authHeader.substring(7);

  try {
    const user = verifyToken(token);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { active: true },
    });

    if (!dbUser || !dbUser.active) {
      return next(new AppError(401, 'ACCOUNT_DISABLED', 'Conta desativada. Entre em contato com o suporte.'));
    }

    req.user = user;
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Token inválido ou expirado'));
  }
}
