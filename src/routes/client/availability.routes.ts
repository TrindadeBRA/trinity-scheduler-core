import { Router, Request, Response, NextFunction } from 'express';
import { getAvailableSlots, getDisabledDates } from '../../services/availability.service';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /availability/slots:
 *   get:
 *     tags: [Client Availability]
 *     summary: Obter slots disponíveis para uma data
 *     parameters:
 *       - in: header
 *         name: X-Shop-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           example: '2024-12-25'
 *         description: Data no formato YYYY-MM-DD
 *       - in: query
 *         name: professionalId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do profissional (opcional — se omitido, retorna união de todos)
 *       - in: query
 *         name: serviceDuration
 *         schema:
 *           type: integer
 *         description: Duração do serviço em minutos (padrão 30)
 *     responses:
 *       200:
 *         description: Lista de slots com disponibilidade
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Slot'
 *       400:
 *         description: Parâmetro date ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/slots', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não resolvido');

    const { date, professionalId, serviceDuration } = req.query;

    if (!date) throw new AppError(400, 'VALIDATION_ERROR', 'Query param date é obrigatório');

    const slots = await getAvailableSlots(
      shopId,
      (professionalId as string) || null,
      date as string,
      serviceDuration ? parseInt(serviceDuration as string, 10) : 30
    );

    res.json(slots);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /availability/disabled-dates:
 *   get:
 *     tags: [Client Availability]
 *     summary: Obter datas sem disponibilidade em um range
 *     parameters:
 *       - in: header
 *         name: X-Shop-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           example: '2024-12-01'
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           example: '2024-12-31'
 *       - in: query
 *         name: professionalId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Array de datas indisponíveis (YYYY-MM-DD)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *                 example: '2024-12-25'
 *       400:
 *         description: Parâmetros ausentes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/disabled-dates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não resolvido');

    const { startDate, endDate, professionalId } = req.query;

    if (!startDate || !endDate) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Query params startDate e endDate são obrigatórios');
    }

    const disabled = await getDisabledDates(
      shopId,
      (professionalId as string) || null,
      startDate as string,
      endDate as string
    );

    res.json(disabled);
  } catch (err) {
    next(err);
  }
});

export default router;
