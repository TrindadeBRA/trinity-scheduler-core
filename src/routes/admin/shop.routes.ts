import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /admin/shop:
 *   get:
 *     tags: [Admin Shop]
 *     summary: Obter dados do estabelecimento
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do estabelecimento
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Shop'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/shop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new AppError(404, 'NOT_FOUND', 'Estabelecimento não encontrado');

    res.json(shop);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/shop:
 *   put:
 *     tags: [Admin Shop]
 *     summary: Atualizar dados do estabelecimento
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Shop'
 *     responses:
 *       200:
 *         description: Estabelecimento atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Shop'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/shop', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const { name, phone, email, address } = req.body;

    const shop = await prisma.shop.update({
      where: { id: shopId },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
      },
    });

    res.json(shop);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/shop/hours:
 *   get:
 *     tags: [Admin Shop]
 *     summary: Obter horários de funcionamento
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de horários por dia da semana
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ShopHour'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/shop/hours', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const hours = await prisma.shopHour.findMany({ where: { shopId } });
    res.json(hours);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/shop/hours:
 *   put:
 *     tags: [Admin Shop]
 *     summary: Atualizar horários de funcionamento
 *     description: Substitui todos os horários de funcionamento. Envie um array com os 7 dias. start/end null indica dia fechado.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/ShopHour'
 *     responses:
 *       200:
 *         description: Horários atualizados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ShopHour'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put('/shop/hours', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const hours: Array<{ day: string; start?: string | null; end?: string | null }> = req.body;

    if (!Array.isArray(hours)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Body deve ser um array de horários');
    }

    const updated = await prisma.$transaction(
      hours.map((h) =>
        prisma.shopHour.upsert({
          where: { shopId_day: { shopId, day: h.day } },
          update: { start: h.start ?? null, end: h.end ?? null },
          create: { shopId, day: h.day, start: h.start ?? null, end: h.end ?? null },
        })
      )
    );

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
