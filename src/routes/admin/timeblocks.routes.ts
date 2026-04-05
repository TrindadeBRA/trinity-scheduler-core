import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /admin/timeblocks:
 *   get:
 *     tags: [Admin TimeBlocks]
 *     summary: Listar bloqueios de horário
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: professionalId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lista de bloqueios
 */
router.get('/timeblocks', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const { date, professionalId, startDate, endDate } = req.query;

    const where: Record<string, unknown> = { shopId };

    if (professionalId) where.professionalId = professionalId as string;
    if (date) {
      where.date = date;
    } else if (startDate || endDate) {
      const dateFilter: Record<string, string> = {};
      if (startDate) dateFilter.gte = startDate as string;
      if (endDate) dateFilter.lte = endDate as string;
      where.date = dateFilter;
    }

    const blocks = await prisma.timeBlock.findMany({ where, orderBy: [{ date: 'asc' }, { startTime: 'asc' }] });
    res.json(blocks);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/timeblocks:
 *   post:
 *     tags: [Admin TimeBlocks]
 *     summary: Criar bloqueio de horário
 */
router.post('/timeblocks', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const { professionalId, date, startTime, duration, reason } = req.body;

    if (!professionalId || !date || !startTime || !duration) {
      throw new AppError(400, 'VALIDATION_ERROR', 'professionalId, date, startTime e duration são obrigatórios');
    }

    const block = await prisma.timeBlock.create({
      data: { shopId, professionalId, date, startTime, duration, reason: reason || null },
    });

    res.status(201).json(block);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/timeblocks:
 *   delete:
 *     tags: [Admin TimeBlocks]
 *     summary: Remover bloqueio de horário
 */
router.delete('/timeblocks/:id', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const existing = await prisma.timeBlock.findFirst({
      where: { id: req.params.id, shopId },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Bloqueio não encontrado');

    await prisma.timeBlock.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
