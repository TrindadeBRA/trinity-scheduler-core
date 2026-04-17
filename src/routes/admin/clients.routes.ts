import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /admin/clients:
 *   get:
 *     tags: [Admin Clients]
 *     summary: Listar clientes (paginado)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por nome ou telefone
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, phone, email, totalSpent, lastVisit, createdAt]
 *           default: createdAt
 *         description: Campo para ordenação
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Direção da ordenação
 *     responses:
 *       200:
 *         description: Lista paginada de clientes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Client'
 *                 total:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/clients', authorize('leader', 'admin', 'professional'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    const { search, page = '1', perPage = '20', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const perPageNum = parseInt(perPage as string, 10);
    const skip = (pageNum - 1) * perPageNum;

    const where: Record<string, unknown> = {};
    if (shopId) where.shopId = shopId;

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const allowedSortFields = ['name', 'phone', 'email', 'totalSpent', 'lastVisit', 'createdAt'];
    const field = allowedSortFields.includes(sortBy as string) ? (sortBy as string) : 'createdAt';
    const direction = sortOrder === 'asc' ? 'asc' : 'desc';

    const [data, total] = await prisma.$transaction([
      prisma.client.findMany({ where, skip, take: perPageNum, orderBy: { [field]: direction } }),
      prisma.client.count({ where }),
    ]);

    res.json({ data, total });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/clients/{id}:
 *   get:
 *     tags: [Admin Clients]
 *     summary: Obter cliente por ID
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
 *         description: Cliente encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/clients/:id', authorize('leader', 'admin', 'professional'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id };
    if (shopId) where.shopId = shopId;

    const client = await prisma.client.findFirst({ where });
    if (!client) throw new AppError(404, 'NOT_FOUND', 'Cliente não encontrado');

    res.json(client);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/clients:
 *   post:
 *     tags: [Admin Clients]
 *     summary: Criar cliente
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ClientInput'
 *     responses:
 *       201:
 *         description: Cliente criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: Telefone já cadastrado neste estabelecimento
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/clients', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const { name, phone, email, notes, birthday } = req.body;
    if (!phone) throw new AppError(400, 'VALIDATION_ERROR', 'Campo phone é obrigatório');

    const client = await prisma.client.create({
      data: { shopId, name, phone, email, notes, birthday },
    });

    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/clients/{id}:
 *   put:
 *     tags: [Admin Clients]
 *     summary: Atualizar cliente
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
 *             $ref: '#/components/schemas/ClientInput'
 *     responses:
 *       200:
 *         description: Cliente atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/clients/:id', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id };
    if (shopId) where.shopId = shopId;

    const existing = await prisma.client.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Cliente não encontrado');

    const { name, phone, email, notes, birthday } = req.body;

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(notes !== undefined && { notes }),
        ...(birthday !== undefined && { birthday }),
      },
    });

    res.json(client);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/clients/{id}:
 *   delete:
 *     tags: [Admin Clients]
 *     summary: Excluir cliente
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
 *         description: Cliente excluído
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/clients/:id', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id };
    if (shopId) where.shopId = shopId;

    const existing = await prisma.client.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Cliente não encontrado');

    await prisma.client.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.patch('/clients/:id/status', authorize('leader', 'admin', 'professional'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id };
    if (shopId) where.shopId = shopId;

    const client = await prisma.client.findFirst({ where, select: { id: true, active: true } });
    if (!client) throw new AppError(404, 'NOT_FOUND', 'Cliente não encontrado');

    const updated = await prisma.client.update({
      where: { id },
      data: { active: !client.active },
      select: { id: true, active: true },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
