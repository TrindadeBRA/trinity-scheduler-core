import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { AppError } from '../../utils/errors';
import { parsePagination, createPaginatedResponse } from '../../utils/pagination';
import { createProfessionalCredentials, updateProfessionalCredentials, getProfessionalUser } from '../../services/professionalCredentials.service';
import { limitMiddleware } from '../../middlewares/limitMiddleware';

const router = Router();

/**
 * @swagger
 * /admin/professionals:
 *   get:
 *     tags: [Admin Professionals]
 *     summary: Listar profissionais (paginado)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por nome, email ou telefone
 *       - in: query
 *         name: unitId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por unidade
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
 *           enum: [name, email, phone, active]
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
 *         description: Lista paginada de profissionais
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Professional'
 *                 total:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/professionals', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    const { search, unitId, page = '1', pageSize = '25', sortBy = 'name', sortOrder = 'asc' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const perPageNum = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * perPageNum;

    const where: Record<string, unknown> = { deletedAt: null };
    if (shopId) where.shopId = shopId;
    
    // Apply professional filter: professionals can only see their own record
    if (req.user?.role === 'professional' && req.user.professionalId) {
      where.id = req.user.professionalId;
    }
    
    if (unitId) {
      where.OR = [
        { unitId: unitId },
        { professionalUnits: { some: { unitId: unitId as string } } },
      ];
    }
    if (search) {
      const term = { contains: search as string, mode: 'insensitive' };
      const searchConditions = [{ name: term }, { email: term }, { phone: term }];
      if (where.OR) {
        where.AND = [{ OR: where.OR as unknown[] }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const allowedSortFields = ['name', 'email', 'phone', 'active'];
    const field = allowedSortFields.includes(sortBy as string) ? (sortBy as string) : 'name';
    const direction = sortOrder === 'asc' ? 'asc' : 'desc';

    const [data, total] = await prisma.$transaction([
      prisma.professional.findMany({
        where,
        skip,
        take: perPageNum,
        include: { workingHours: true, professionalUnits: { include: { unit: true } }, professionalServices: { include: { service: { select: { id: true, name: true } } } } },
        orderBy: { [field]: direction },
      }),
      prisma.professional.count({ where }),
    ]);

    res.json({ data, total });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/professionals/{id}:
 *   get:
 *     tags: [Admin Professionals]
 *     summary: Obter profissional por ID (inclui workingHours)
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
 *         description: Profissional encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Professional'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/professionals/:id', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const shopId = req.shopId || req.user?.shopId;

    // Professional can only access their own record
    if (req.user?.role === 'professional' && req.user.professionalId !== id) {
      throw new AppError(403, 'FORBIDDEN', 'Profissional só pode acessar o próprio registro');
    }

    const where: Record<string, unknown> = { id, deletedAt: null };
    if (shopId) where.shopId = shopId;

    const professional = await prisma.professional.findFirst({
      where,
      include: { workingHours: true, professionalUnits: { include: { unit: true } }, professionalServices: { include: { service: { select: { id: true, name: true } } } } },
    });

    if (!professional) throw new AppError(404, 'NOT_FOUND', 'Profissional não encontrado');
    res.json(professional);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/professionals:
 *   post:
 *     tags: [Admin Professionals]
 *     summary: Criar profissional
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProfessionalInput'
 *     responses:
 *       201:
 *         description: Profissional criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Professional'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/professionals', authorize('leader', 'admin'), limitMiddleware('professional'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const { name, unitId, avatar, specialties, phone, email, active, workingHours, credentials } = req.body;

    if (!name) throw new AppError(400, 'VALIDATION_ERROR', 'Campo name é obrigatório');

    // Valida email de credenciais antes de criar qualquer coisa
    if (credentials?.email) {
      const existingUser = await prisma.user.findUnique({ where: { email: credentials.email } });
      if (existingUser) {
        throw new AppError(409, 'CONFLICT', 'Email já está em uso');
      }
    }

    const professional = await prisma.professional.create({
      data: {
        shopId,
        name,
        unitId: unitId || null,
        avatar: avatar || null,
        specialties: specialties || [],
        phone: phone || null,
        email: email || null,
        active: active ?? true,
        ...(workingHours && {
          workingHours: {
            create: workingHours.map((wh: { day: string; start?: string; end?: string; lunchStart?: string; lunchEnd?: string }) => ({
              day: wh.day,
              start: wh.start || null,
              end: wh.end || null,
              lunchStart: wh.lunchStart || null,
              lunchEnd: wh.lunchEnd || null,
            })),
          },
        }),
      },
      include: { workingHours: true, professionalUnits: { include: { unit: true } } },
    });

    // Create user credentials if provided
    if (credentials?.email && credentials?.password) {
      try {
        await createProfessionalCredentials({
          professionalId: professional.id,
          shopId,
          name: professional.name,
          email: credentials.email,
          password: credentials.password,
        });
      } catch (credErr) {
        // Rollback: remove o profissional criado para não deixar registro órfão
        await prisma.professional.delete({ where: { id: professional.id } });
        if (credErr instanceof AppError) throw credErr;
        throw new AppError(500, 'INTERNAL_ERROR', 'Falha ao enviar email de credenciais ao profissional');
      }
    }

    res.status(201).json(professional);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/professionals/{id}:
 *   put:
 *     tags: [Admin Professionals]
 *     summary: Atualizar profissional
 *     description: Professional pode editar apenas o próprio registro. Leader/admin podem editar qualquer profissional.
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
 *             $ref: '#/components/schemas/ProfessionalInput'
 *     responses:
 *       200:
 *         description: Profissional atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Professional'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/professionals/:id', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const shopId = req.shopId || req.user?.shopId;

    // Professional só pode editar o próprio registro
    if (req.user?.role === 'professional' && req.user.professionalId !== id) {
      throw new AppError(403, 'FORBIDDEN', 'Profissional só pode editar o próprio registro');
    }

    const where: Record<string, unknown> = { id, deletedAt: null };
    if (shopId) where.shopId = shopId;

    const existing = await prisma.professional.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Profissional não encontrado');

    const { name, unitId, avatar, specialties, phone, email, active, workingHours, credentials } = req.body;

    const professional = await prisma.professional.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(unitId !== undefined && { unitId }),
        ...(avatar !== undefined && { avatar }),
        ...(specialties !== undefined && { specialties }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(active !== undefined && { active }),
        ...(workingHours && {
          workingHours: {
            deleteMany: {},
            create: workingHours.map((wh: { day: string; start?: string; end?: string; lunchStart?: string; lunchEnd?: string }) => ({
              day: wh.day,
              start: wh.start || null,
              end: wh.end || null,
              lunchStart: wh.lunchStart || null,
              lunchEnd: wh.lunchEnd || null,
            })),
          },
        }),
      },
      include: { workingHours: true, professionalUnits: { include: { unit: true } } },
    });

    // Update or create credentials if provided
    if (credentials && (credentials.email || credentials.password)) {
      const existingUser = await getProfessionalUser(id);
      
      if (existingUser) {
        // Update existing credentials
        await updateProfessionalCredentials({
          professionalId: id,
          email: credentials.email,
          password: credentials.password,
        });
      } else if (credentials.email && credentials.password) {
        // Create new credentials (both email and password required for creation)
        await createProfessionalCredentials({
          professionalId: id,
          shopId: professional.shopId,
          name: professional.name,
          email: credentials.email,
          password: credentials.password,
        });
      }
    }

    res.json(professional);
  } catch (err) {
    next(err);
  }
});

router.get('/professionals/:id/services', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const allocations = await prisma.professionalService.findMany({
      where: { professionalId: id },
      include: { service: { select: { id: true, name: true } } },
      orderBy: { service: { name: 'asc' } },
    });
    res.json(allocations);
  } catch (err) {
    next(err);
  }
});

router.put('/professionals/:id/services', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { serviceIds } = req.body as { serviceIds: string[] };

    if (!Array.isArray(serviceIds)) throw new AppError(400, 'VALIDATION_ERROR', 'serviceIds deve ser um array');

    const shopId = req.shopId || req.user?.shopId;
    const where: Record<string, unknown> = { id, deletedAt: null };
    if (shopId) where.shopId = shopId;

    const existing = await prisma.professional.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Profissional não encontrado');

    await prisma.$transaction([
      prisma.professionalService.deleteMany({ where: { professionalId: id } }),
      ...serviceIds.map(serviceId =>
        prisma.professionalService.create({ data: { professionalId: id, serviceId } })
      ),
    ]);

    const allocations = await prisma.professionalService.findMany({
      where: { professionalId: id },
      include: { service: { select: { id: true, name: true } } },
      orderBy: { service: { name: 'asc' } },
    });

    res.json(allocations);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/professionals/{id}/units:
 *   get:
 *     tags: [Admin Professionals]
 *     summary: Listar unidades alocadas ao profissional
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
 *         description: Lista de unidades alocadas
 */
router.get('/professionals/:id/units', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const allocations = await prisma.professionalUnit.findMany({
      where: { professionalId: id },
      include: { unit: true },
      orderBy: { unit: { name: 'asc' } },
    });
    res.json(allocations);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/professionals/{id}/units:
 *   put:
 *     tags: [Admin Professionals]
 *     summary: Atualizar alocação de unidades do profissional
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
 *             type: object
 *             properties:
 *               unitIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Alocações atualizadas
 */
router.put('/professionals/:id/units', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { unitIds } = req.body as { unitIds: string[] };

    if (!Array.isArray(unitIds)) throw new AppError(400, 'VALIDATION_ERROR', 'unitIds deve ser um array');

    const shopId = req.shopId || req.user?.shopId;
    const where: Record<string, unknown> = { id, deletedAt: null };
    if (shopId) where.shopId = shopId;

    const existing = await prisma.professional.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Profissional não encontrado');

    // Replace all allocations
    await prisma.$transaction([
      prisma.professionalUnit.deleteMany({ where: { professionalId: id } }),
      ...unitIds.map(unitId =>
        prisma.professionalUnit.create({ data: { professionalId: id, unitId } })
      ),
    ]);

    // Also update the legacy unitId to the first unit (backward compat)
    await prisma.professional.update({
      where: { id },
      data: { unitId: unitIds[0] || null },
    });

    const allocations = await prisma.professionalUnit.findMany({
      where: { professionalId: id },
      include: { unit: true },
      orderBy: { unit: { name: 'asc' } },
    });

    res.json(allocations);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/professionals/{id}:
 *   delete:
 *     tags: [Admin Professionals]
 *     summary: Excluir profissional (soft delete)
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
 *         description: Profissional excluído
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/professionals/:id', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id, deletedAt: null };
    if (shopId) where.shopId = shopId;

    const existing = await prisma.professional.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Profissional não encontrado');

    // Soft delete: marca deletedAt ao invés de remover do banco
    await prisma.professional.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
