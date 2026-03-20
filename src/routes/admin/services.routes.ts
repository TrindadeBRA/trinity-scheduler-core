import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /admin/services:
 *   get:
 *     tags: [Admin Services]
 *     summary: Listar serviços e adicionais
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de serviços e adicionais
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/services', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    const { search, type } = req.query;

    const where: Record<string, unknown> = {};
    if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (type && type !== 'all') where.type = type;

    const services = await prisma.service.findMany({ where, orderBy: { name: 'asc' } });
    res.json(services);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/services/{id}:
 *   get:
 *     tags: [Admin Services]
 *     summary: Obter serviço por ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Serviço encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/services/:id', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id };
    if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

    const service = await prisma.service.findFirst({ where });
    if (!service) throw new AppError(404, 'NOT_FOUND', 'Serviço não encontrado');

    res.json(service);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/services:
 *   post:
 *     tags: [Admin Services]
 *     summary: Criar serviço ou adicional
 *     description: "Preço deve ser enviado em centavos (ex: R$ 45,00 = 4500)."
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceInput'
 *     responses:
 *       201:
 *         description: Serviço criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/services', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const { name, duration, price, description, icon, image, type, active } = req.body;

    if (!name || duration === undefined || price === undefined || !type) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Campos name, duration, price e type são obrigatórios');
    }

    const service = await prisma.service.create({
      data: { shopId, name, duration, price, description, icon, image, type, active: active ?? true },
    });

    res.status(201).json(service);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/services/{id}:
 *   put:
 *     tags: [Admin Services]
 *     summary: Atualizar serviço ou adicional
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceInput'
 *     responses:
 *       200:
 *         description: Serviço atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/services/:id', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id };
    if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

    const existing = await prisma.service.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Serviço não encontrado');

    const { name, duration, price, description, icon, image, type, active } = req.body;

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(duration !== undefined && { duration }),
        ...(price !== undefined && { price }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(image !== undefined && { image }),
        ...(type !== undefined && { type }),
        ...(active !== undefined && { active }),
      },
    });

    res.json(service);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/services/{id}:
 *   delete:
 *     tags: [Admin Services]
 *     summary: Excluir serviço ou adicional
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Serviço excluído
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/services/:id', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id };
    if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

    const existing = await prisma.service.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Serviço não encontrado');

    await prisma.service.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
