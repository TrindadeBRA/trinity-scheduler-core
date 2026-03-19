import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';

export async function shopResolver(req: Request, res: Response, next: NextFunction): Promise<void> {
  const shopId = (req.headers['x-shop-id'] as string) || (req.query.shopId as string);

  if (!shopId) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Header X-Shop-Id ou query param shopId é obrigatório'));
  }

  try {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });

    if (!shop) {
      return next(new AppError(404, 'NOT_FOUND', 'Estabelecimento não encontrado'));
    }

    req.shopId = shopId;
    next();
  } catch (err) {
    next(err);
  }
}
