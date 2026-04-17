import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { AppError } from '../../utils/errors';
import { parsePagination, createPaginatedResponse } from '../../utils/pagination';

const router = Router();

/**
 * @swagger
 * /admin/services:
 *   get:
 *     tags: [Admin Services]
 *     summary: Listar serviços e adicionais (paginado)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por nome ou descrição
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [service, addon, all]
 *         description: Filtrar por tipo
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 25
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, duration, price, type, active]
 *           default: name
 *         description: Campo para ordenação
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Direção da ordenação
 *     responses:
 *       200:
 *         description: Lista paginada de serviços e adicionais
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Service'
 *                 total:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/services', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    const { search, type, page = '1', pageSize = '25', sortBy = 'name', sortOrder = 'asc' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const perPageNum = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * perPageNum;

    const where: Record<string, unknown> = { deletedAt: null };
    if (shopId) where.shopId = shopId;

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (type && type !== 'all') where.type = type;

    const allowedSortFields = ['name', 'duration', 'price', 'type', 'active'];
    const field = allowedSortFields.includes(sortBy as string) ? (sortBy as string) : 'name';
    const direction = sortOrder === 'asc' ? 'asc' : 'desc';

    const [data, total] = await prisma.$transaction([
      prisma.service.findMany({ where, skip, take: perPageNum, orderBy: { [field]: direction }, include: { professionalServices: { include: { professional: { select: { id: true, name: true, avatar: true, email: true } } } } } }),
      prisma.service.count({ where }),
    ]);

    res.json({ data, total });
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

    const where: Record<string, unknown> = { id, deletedAt: null };
    if (shopId) where.shopId = shopId;

    const service = await prisma.service.findFirst({ where, include: { professionalServices: { include: { professional: { select: { id: true, name: true } } } } } });
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
    const id = req.params.id as string;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id, deletedAt: null };
    if (shopId) where.shopId = shopId;

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
    const id = req.params.id as string;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id, deletedAt: null };
    if (shopId) where.shopId = shopId;

    const existing = await prisma.service.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Serviço não encontrado');

    // Verifica se há agendamentos futuros vinculados
    const today = new Date().toISOString().split('T')[0];
    const futureAppointments = await prisma.appointment.count({
      where: {
        serviceId: id,
        date: { gte: today },
        status: { in: ['confirmed'] },
      },
    });

    if (futureAppointments > 0) {
      throw new AppError(
        409,
        'HAS_FUTURE_APPOINTMENTS',
        `Não é possível excluir este serviço pois há ${futureAppointments} agendamento(s) futuro(s) vinculado(s). Cancele-os antes de excluir.`
      );
    }

    // Soft delete
    await prisma.service.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/services/:id/professionals', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const allocations = await prisma.professionalService.findMany({
      where: { serviceId: id },
      include: { professional: { select: { id: true, name: true } } },
      orderBy: { professional: { name: 'asc' } },
    });
    res.json(allocations);
  } catch (err) {
    next(err);
  }
});

router.put('/services/:id/professionals', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { professionalIds } = req.body as { professionalIds: string[] };

    if (!Array.isArray(professionalIds)) throw new AppError(400, 'VALIDATION_ERROR', 'professionalIds deve ser um array');

    const shopId = req.shopId || req.user?.shopId;
    const where: Record<string, unknown> = { id };
    if (shopId) where.shopId = shopId;

    const existing = await prisma.service.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Serviço não encontrado');

    await prisma.$transaction([
      prisma.professionalService.deleteMany({ where: { serviceId: id } }),
      ...professionalIds.map(professionalId =>
        prisma.professionalService.create({ data: { serviceId: id, professionalId } })
      ),
    ]);

    const allocations = await prisma.professionalService.findMany({
      where: { serviceId: id },
      include: { professional: { select: { id: true, name: true } } },
      orderBy: { professional: { name: 'asc' } },
    });

    res.json(allocations);
  } catch (err) {
    next(err);
  }
});

export default router;
