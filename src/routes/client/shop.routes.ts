import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /shop/info:
 *   get:
 *     tags: [Client Shop]
 *     summary: Obter informações públicas do estabelecimento
 *     parameters:
 *       - in: header
 *         name: X-Shop-Id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Informações do estabelecimento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 */
router.get('/info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não resolvido');

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { name: true },
    });

    if (!shop) throw new AppError(404, 'NOT_FOUND', 'Estabelecimento não encontrado');

    res.json(shop);
  } catch (err) {
    next(err);
  }
});

export default router;
