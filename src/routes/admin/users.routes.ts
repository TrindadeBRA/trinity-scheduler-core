import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { AppError } from '../../utils/errors';
import { parsePagination, createPaginatedResponse } from '../../utils/pagination';

function computeTrialDaysRemaining(
  createdAt: Date,
  subscriptionStatus: string | null,
  now?: Date
): number | null {
  const PAID_STATUSES = ['ACTIVE', 'CONFIRMED'];
  if (subscriptionStatus && PAID_STATUSES.includes(subscriptionStatus)) {
    return null;
  }
  const diffMs = (now ?? new Date()).getTime() - createdAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, 30 - diffDays);
}

function computeHasPaidPlan(
  userPlan: { planId: string; subscriptionStatus: string } | null
): boolean {
  if (!userPlan) return false;
  const PAID_STATUSES = ['ACTIVE', 'CONFIRMED'];
  return userPlan.planId !== 'FREE' && PAID_STATUSES.includes(userPlan.subscriptionStatus);
}

const router = Router();

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin Users]
 *     summary: Listar usuários e seus profissionais (apenas admin)
 *     description: >
 *       Retorna lista paginada de usuários (leaders e admins) com profissionais vinculados,
 *       dados do plano, contagem de agendamentos e unidades.
 *       Filtro por role=admin também retorna leaders com plano ADMIN.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por nome, e-mail ou nome do estabelecimento
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, leader]
 *         description: Filtrar por role (admin inclui users com plano ADMIN)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Lista paginada de usuários
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdminUserItem'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pageSize:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/users', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, page, pageSize, role: roleFilter, active: activeFilter } = req.query;
    const { skip, take, page: pageNum, pageSize: pageSizeNum } = parsePagination({
      page: page as string,
      pageSize: pageSize as string,
    });

    const searchTerm = (search as string | undefined)?.trim();

    const allowedRoles = ['leader', 'admin'];
    const roleParam = roleFilter as string | undefined;
    const roles = roleParam && allowedRoles.includes(roleParam)
      ? [roleParam]
      : allowedRoles;

    const where: Record<string, unknown> = {};
    if (activeFilter === 'true') where.active = true;
    else if (activeFilter === 'false') where.active = false;
    // 'all' ou omitido = sem filtro

    if (roleParam === 'admin') {
      where.OR = [
        { role: 'admin' as const },
        { userPlan: { is: { planId: 'ADMIN' } } },
      ];
    } else {
      where.role = { in: roles };
    }

    if (searchTerm) {
      const searchConditions = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { shop: { is: { name: { contains: searchTerm, mode: 'insensitive' } } } },
      ];

      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const [leaders, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          shopId: true,
          referralId: true,
          createdAt: true,
          shop: { select: { id: true, name: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Busca profissionais de todos os shops de uma vez (evita N+1)
    const allShopIds = [...new Set(leaders.map(l => l.shopId).filter(Boolean))];

    const userIds = leaders.map(l => l.id);

    const allUserPlans = userIds.length > 0
      ? await prisma.userPlan.findMany({
          where: { userId: { in: userIds } },
          include: { plan: { select: { id: true, name: true } } },
        })
      : [];

    const appointmentCounts = allShopIds.length > 0
      ? await prisma.appointment.groupBy({
          by: ['shopId'],
          where: { shopId: { in: allShopIds } },
          _count: { id: true },
        })
      : [];

    const unitCounts = allShopIds.length > 0
      ? await prisma.unit.groupBy({
          by: ['shopId'],
          where: { shopId: { in: allShopIds } },
          _count: { id: true },
        })
      : [];

    const referralIds = [...new Set(leaders.map(l => l.referralId).filter(Boolean))] as string[];
    const allReferrals = referralIds.length > 0
      ? await prisma.referral.findMany({
          where: { id: { in: referralIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const referralById = allReferrals.reduce<Record<string, typeof allReferrals[0]>>((acc, r) => {
      acc[r.id] = r;
      return acc;
    }, {});

    const allProfessionals = allShopIds.length > 0
      ? await prisma.professional.findMany({
          where: { shopId: { in: allShopIds }, deletedAt: null },
          select: { id: true, shopId: true, name: true, email: true, phone: true, active: true },
          orderBy: { name: 'asc' },
        })
      : [];

    const profsByShop = allProfessionals.reduce<Record<string, typeof allProfessionals>>((acc, p) => {
      if (!acc[p.shopId]) acc[p.shopId] = [];
      acc[p.shopId].push(p);
      return acc;
    }, {});

    const userPlanByUserId = allUserPlans.reduce<Record<string, typeof allUserPlans[0]>>((acc, up) => {
      acc[up.userId] = up;
      return acc;
    }, {});

    const appointmentCountByShopId = appointmentCounts.reduce<Record<string, number>>((acc, ac) => {
      acc[ac.shopId] = ac._count.id;
      return acc;
    }, {});

    const unitCountByShopId = unitCounts.reduce<Record<string, number>>((acc, uc) => {
      acc[uc.shopId] = uc._count.id;
      return acc;
    }, {});

    const data = leaders.map((user) => {
      const professionals = user.shopId ? (profsByShop[user.shopId] ?? []) : [];
      const userPlan = userPlanByUserId[user.id] ?? null;
      const subscriptionStatus = userPlan?.subscriptionStatus ?? null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        shopName: (user.shop as any).name,
        professionals,
        professionalsTotal: professionals.length,
        // new fields
        createdAt: user.createdAt,
        trialDaysRemaining: computeTrialDaysRemaining(user.createdAt, subscriptionStatus),
        hasPaidPlan: computeHasPaidPlan(userPlan),
        plan: {
          planId: userPlan?.planId ?? 'FREE',
          planName: (userPlan as any)?.plan?.name ?? 'Free',
          subscriptionStatus: userPlan?.subscriptionStatus ?? 'TRIAL',
          subscriptionId: userPlan?.subscriptionId ?? null,
          planExpiresAt: (userPlan as any)?.planExpiresAt ?? null,
        },
        appointmentsCount: appointmentCountByShopId[user.shopId] ?? 0,
        unitsCount: unitCountByShopId[user.shopId] ?? 0,
        referral: user.referralId ? (referralById[user.referralId] ?? null) : null,
      };
    });

    res.json(createPaginatedResponse(data, total, pageNum, pageSizeNum));
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/users/{userId}/plan:
 *   patch:
 *     tags: [Admin Users]
 *     summary: Alterar plano de um usuário (apenas admin)
 *     description: >
 *       Atualiza o plano do usuário. Quando o plano é ADMIN, o role do usuário
 *       é promovido para admin automaticamente. Quando sai do plano ADMIN,
 *       o role volta para leader.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *             required: [planId]
 *             properties:
 *               planId:
 *                 type: string
 *                 enum: [FREE, PREMIUM, PRO, ADMIN]
 *               planExpiresAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 description: Data de expiração do plano (null = permanente). Deve ser futura.
 *     responses:
 *       200:
 *         description: Plano atualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 planId:
 *                   type: string
 *                   enum: [FREE, PREMIUM, PRO, ADMIN]
 *                 planName:
 *                   type: string
 *                 subscriptionStatus:
 *                   type: string
 *                   enum: [TRIAL, ACTIVE, CONFIRMED, INACTIVE]
 *                 planExpiresAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *       400:
 *         description: Erro de validação (planId obrigatório, data inválida ou no passado)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/users/:userId/plan', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const planId = String(req.body.planId ?? '');
    const rawExpires: string | null | undefined = req.body.planExpiresAt;

    if (!planId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'planId é obrigatório');
    }

    if (rawExpires !== undefined && rawExpires !== null) {
      const parsed = new Date(rawExpires);
      if (isNaN(parsed.getTime())) {
        throw new AppError(400, 'VALIDATION_ERROR', 'planExpiresAt deve ser uma data válida');
      }
      if (parsed <= new Date()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'planExpiresAt deve ser uma data futura');
      }
    }

    const [user, plan] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.plan.findUnique({ where: { id: planId } }),
    ]);

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'Usuário não encontrado');
    }

    if (!plan) {
      throw new AppError(404, 'NOT_FOUND', 'Plano não encontrado');
    }

    const expiresAt = rawExpires ? new Date(rawExpires) : null;

    const updateData: Record<string, unknown> = {
      planId,
      subscriptionStatus: planId === 'FREE' ? 'TRIAL' : 'ACTIVE',
      subscriptionId: planId === 'FREE' ? null : undefined,
      isPackage: false,
      packageExpiresAt: null,
      planExpiresAt: expiresAt,
    };

    const isAdminPlan = planId === 'ADMIN';
    const wasAdminPlan = user.role === 'admin';

    const [userPlan] = await prisma.$transaction([
      prisma.userPlan.upsert({
        where: { userId },
        update: updateData as any,
        create: {
          userId,
          planId,
          subscriptionStatus: planId === 'FREE' ? 'TRIAL' : 'ACTIVE',
          planExpiresAt: expiresAt,
        } as any,
      }),
      ...(isAdminPlan && !wasAdminPlan
        ? [prisma.user.update({ where: { id: userId }, data: { role: 'admin' } })]
        : []),
      ...(!isAdminPlan && wasAdminPlan
        ? [prisma.user.update({ where: { id: userId }, data: { role: 'leader' } })]
        : []),
    ]);

    res.json({
      planId: userPlan.planId,
      planName: plan.name,
      subscriptionStatus: userPlan.subscriptionStatus,
      planExpiresAt: (userPlan as any).planExpiresAt ?? null,
    });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    console.error('[users] PATCH /users/:userId/plan error:', err);
    next(err);
  }
});

/**
 * PATCH /admin/users/:userId/status
 * Ativa ou desativa a conta de um usuário (apenas admin)
 */
router.patch('/users/:userId/status', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;

    if (userId === req.user?.id) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Você não pode desativar sua própria conta');
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, active: true, role: true } });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'Usuário não encontrado');

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { active: !user.active },
      select: { id: true, active: true },
    });

    res.json({ id: updated.id, active: updated.active });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/users/:userId
 * Retorna detalhes completos de um usuário (apenas admin)
 */
router.get('/users/:userId', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        shopId: true,
        referralId: true,
        createdAt: true,
        shop: { select: { id: true, name: true } },
      },
    });

    if (!user) throw new AppError(404, 'NOT_FOUND', 'Usuário não encontrado');

    const [userPlan, appointmentsCount, unitsCount, professionals, referral] = await Promise.all([
      prisma.userPlan.findUnique({
        where: { userId },
        include: { plan: { select: { id: true, name: true } } },
      }),
      prisma.appointment.count({ where: { shopId: user.shopId } }),
      prisma.unit.count({ where: { shopId: user.shopId } }),
      prisma.professional.findMany({
        where: { shopId: user.shopId, deletedAt: null },
        select: { id: true, name: true, email: true, phone: true, active: true, avatar: true, specialties: true },
        orderBy: { name: 'asc' },
      }),
      user.referralId
        ? prisma.referral.findUnique({ where: { id: user.referralId }, select: { id: true, code: true, name: true } })
        : Promise.resolve(null),
    ]);

    const subscriptionStatus = userPlan?.subscriptionStatus ?? null;

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      shopId: user.shopId,
      shopName: (user as any).shop.name,
      createdAt: user.createdAt,
      trialDaysRemaining: computeTrialDaysRemaining(user.createdAt, subscriptionStatus),
      hasPaidPlan: computeHasPaidPlan(userPlan),
      plan: {
        planId: userPlan?.planId ?? 'FREE',
        planName: (userPlan as any)?.plan?.name ?? 'Free',
        subscriptionStatus: userPlan?.subscriptionStatus ?? 'TRIAL',
        subscriptionId: userPlan?.subscriptionId ?? null,
        planExpiresAt: (userPlan as any)?.planExpiresAt ?? null,
      },
      appointmentsCount,
      unitsCount,
      professionals,
      referral,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /admin/users/:userId
 * Atualiza nome e e-mail de um usuário (apenas admin)
 */
router.put('/users/:userId', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const name = String(req.body.name ?? '').trim();
    const email = String(req.body.email ?? '').trim().toLowerCase();

    if (!name) throw new AppError(400, 'VALIDATION_ERROR', 'Nome é obrigatório');
    if (!email) throw new AppError(400, 'VALIDATION_ERROR', 'E-mail é obrigatório');

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Usuário não encontrado');

    if (email !== existing.email) {
      const conflict = await prisma.user.findUnique({ where: { email } });
      if (conflict) throw new AppError(409, 'CONFLICT', 'E-mail já está em uso por outro usuário');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name, email },
      select: { id: true, name: true, email: true, role: true, updatedAt: true },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /admin/users/:userId/professionals/:profId
 * Retorna detalhes de um profissional de qualquer shop (apenas admin)
 */
router.get('/users/:userId/professionals/:profId', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const profId = req.params.profId as string;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { shopId: true } });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'Usuário não encontrado');

    const professional = await prisma.professional.findFirst({
      where: { id: profId, shopId: user.shopId, deletedAt: null },
      include: {
        professionalUnits: { include: { unit: { select: { id: true, name: true } } } },
        professionalServices: { include: { service: { select: { id: true, name: true } } } },
      },
    });

    if (!professional) throw new AppError(404, 'NOT_FOUND', 'Profissional não encontrado');

    res.json(professional);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /admin/users/:userId/professionals/:profId
 * Atualiza dados de um profissional de qualquer shop (apenas admin)
 */
router.put('/users/:userId/professionals/:profId', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const profId = req.params.profId as string;
    const { name, phone, email, specialties, active } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { shopId: true } });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'Usuário não encontrado');

    const existing = await prisma.professional.findFirst({
      where: { id: profId, shopId: user.shopId, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Profissional não encontrado');

    const nameClean = String(name ?? '').trim();
    if (!nameClean) throw new AppError(400, 'VALIDATION_ERROR', 'Nome é obrigatório');

    const updated = await prisma.professional.update({
      where: { id: profId },
      data: {
        name: nameClean,
        phone: phone ? String(phone).trim() : null,
        email: email ? String(email).trim().toLowerCase() : null,
        specialties: Array.isArray(specialties) ? specialties : existing.specialties,
        active: typeof active === 'boolean' ? active : existing.active,
      },
      include: {
        professionalUnits: { include: { unit: { select: { id: true, name: true } } } },
        professionalServices: { include: { service: { select: { id: true, name: true } } } },
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
