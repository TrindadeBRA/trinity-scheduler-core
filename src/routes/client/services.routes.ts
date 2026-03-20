import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /services:
 *   get:
 *     tags: [Client Services]
 *     summary: Listar serviços disponíveis
 *     description: Retorna todos os serviços ativos do estabelecimento (type=service).
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
      select: { id: true, name: true, duration: true, price: true, description: true, icon: true, image: true },
    });

    res.json(services);
  } catch (err) {
    next(err);
  }
});

export default router;
