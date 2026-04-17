import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/errors';
import { computePriceRange, resolvePriceForDate } from '../../utils/priceResolver';

const router = Router();

/**
 * @swagger
 * /services/prices:
 *   get:
 *     tags: [Client Services]
 *     summary: Resolver preços de serviços para uma data
 *     description: Retorna os preços resolvidos de todos os serviços e addons ativos para a data informada.
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
 *           example: "2025-03-15"
 *     responses:
 *       200:
 *         description: Preços resolvidos para a data
 *       400:
 *         description: Data ausente ou inválida
 */
router.get('/prices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não resolvido');

    const { date } = req.query;

    if (!date) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Query param date é obrigatório');
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date as string)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Data inválida. Use o formato YYYY-MM-DD');
    }

    const parsed = new Date((date as string) + 'T00:00:00');
    if (isNaN(parsed.getTime())) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Data inválida. Use o formato YYYY-MM-DD');
    }

    const services = await prisma.service.findMany({
      where: { shopId, active: true },
      include: { priceRules: true },
    });

    res.json({
      date,
      dayOfWeek: parsed.getDay(),
      prices: services.map((s) => ({
        serviceId: s.id,
        price: resolvePriceForDate(s.price, s.priceRules, date as string),
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /services:
 *   get:
 *     tags: [Client Services]
 *     summary: Listar serviços disponíveis
 *     description: Retorna todos os serviços ativos do estabelecimento (type=service) com faixa de preço.
 *     parameters:
 *       - in: header
 *         name: X-Shop-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lista de serviços
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 *       400:
 *         description: shopId não resolvido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não resolvido');

    const services = await prisma.service.findMany({
      where: { shopId, type: 'service', active: true },
      include: { priceRules: true },
    });

    const result = services.map((s) => {
      const { minPrice, maxPrice } = computePriceRange(s.price, s.priceRules);
      return {
        id: s.id,
        name: s.name,
        duration: s.duration,
        price: s.price,
        minPrice,
        maxPrice,
        description: s.description,
        icon: s.icon,
        image: s.image,
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
