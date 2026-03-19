import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /addons:
 *   get:
 *     tags: [Client Addons]
 *     summary: Listar adicionais disponíveis
 *     description: Retorna todos os adicionais ativos do estabelecimento (type=addon).
 *     parameters:
 *       - in: header
 *         name: X-Shop-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lista de adicionais
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 *       400:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não resolvido');

    const addons = await prisma.service.findMany({
      where: { shopId, type: 'addon', active: true },
      select: { id: true, name: true, duration: true, price: true, description: true, icon: true, image: true },
    });

    res.json(addons);
  } catch (err) {
    next(err);
  }
});

export default router;
