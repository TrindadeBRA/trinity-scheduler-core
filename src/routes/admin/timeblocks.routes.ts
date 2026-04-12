import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { AppError } from '../../utils/errors';
import { createTimeBlocks } from '../../services/timeblock.service';

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
 *     summary: Criar bloqueio de horário (único ou recorrente)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [professionalId, date, startTime, duration]
 *             properties:
 *               professionalId:
 *                 type: string
 *                 format: uuid
 *               date:
 *                 type: string
 *                 format: date
 *               startTime:
 *                 type: string
 *                 example: "12:00"
 *               duration:
 *                 type: integer
 *                 example: 60
 *               reason:
 *                 type: string
 *               recurrenceDays:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [Domingo, Segunda, Terça, Quarta, Quinta, Sexta, Sábado]
 *               recurrenceEndDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Bloqueio(s) criado(s)
 *       409:
 *         description: Conflito com agendamentos existentes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: CONFLICT
 *                 message:
 *                   type: string
 *                 conflicts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                       time:
 *                         type: string
 *                       clientName:
 *                         type: string
 *                       serviceName:
 *                         type: string
 */
router.post('/timeblocks', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const { professionalId, date, startTime, duration, reason, recurrenceDays, recurrenceEndDate } = req.body;

    if (!professionalId || !date || !startTime || !duration) {
      throw new AppError(400, 'VALIDATION_ERROR', 'professionalId, date, startTime e duration são obrigatórios');
    }

    const result = await createTimeBlocks({
      shopId,
      professionalId,
      date,
      startTime,
      duration,
      reason: reason || null,
      recurrenceDays,
      recurrenceEndDate,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/timeblocks/{id}:
 *   delete:
 *     tags: [Admin TimeBlocks]
 *     summary: Remover bloqueio de horário (com escopo para séries recorrentes)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *           enum: [single, future, all]
 *           default: single
 *     responses:
 *       204:
 *         description: Bloqueio(s) removido(s)
 *       400:
 *         description: Scope inválido
 *       404:
 *         description: Bloqueio não encontrado
 */
router.delete('/timeblocks/:id', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const blockId = req.params.id as string;
    const scope = (req.query.scope as string) || 'single';

    if (!['single', 'future', 'all'].includes(scope)) {
      throw new AppError(400, 'VALIDATION_ERROR', "scope deve ser 'single', 'future' ou 'all'");
    }

    const existing = await prisma.timeBlock.findFirst({
      where: { id: blockId, shopId },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Bloqueio não encontrado');

    if (scope === 'single' || !existing.recurrenceGroupId) {
      await prisma.timeBlock.delete({ where: { id: blockId } });
    } else if (scope === 'future') {
      await prisma.timeBlock.deleteMany({
        where: { recurrenceGroupId: existing.recurrenceGroupId, date: { gte: existing.date } },
      });
    } else if (scope === 'all') {
      await prisma.timeBlock.deleteMany({
        where: { recurrenceGroupId: existing.recurrenceGroupId },
      });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
