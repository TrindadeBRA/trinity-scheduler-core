import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /professionals:
 *   get:
 *     tags: [Client Professionals]
 *     summary: Listar profissionais disponíveis
 *     description: Retorna todos os profissionais ativos do estabelecimento. Pode filtrar por unidade.
 *     parameters:
 *       - in: header
 *         name: X-Shop-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: unitId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por unidade
 *     responses:
 *       200:
 *         description: Lista de profissionais
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   name:
 *                     type: string
 *                   avatar:
 *                     type: string
 *                     nullable: true
 *                   specialties:
 *                     type: array
 *                     items:
 *                       type: string
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

    const { unitId } = req.query;
    const where: Record<string, unknown> = { shopId, active: true };

    if (unitId) {
      where.OR = [
        { unitId: unitId },
        { professionalUnits: { some: { unitId: unitId as string } } },
      ];
    }

    const professionals = await prisma.professional.findMany({
      where,
      select: { id: true, name: true, avatar: true, specialties: true },
    });

    res.json(professionals);
  } catch (err) {
    next(err);
  }
});

export default router;
