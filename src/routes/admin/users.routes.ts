import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
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
 *     summary: Listar todos os leaders e seus profissionais (apenas admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por nome, e-mail ou nome do estabelecimento
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
 *         description: Lista paginada de leaders com seus profissionais
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/users', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, page, pageSize, role: roleFilter } = req.query;
    const { skip, take, page: pageNum, pageSize: pageSizeNum } = parsePagination({
      page: page as string,
      pageSize: pageSize as string,
    });

    const searchTerm = (search as string | undefined)?.trim();

    // Por padrão lista leader e admin; permite filtrar por role específica
    const allowedRoles = ['leader', 'admin'];
    const roles = roleFilter && allowedRoles.includes(roleFilter as string)
      ? [roleFilter as string]
      : allowedRoles;

    const where: Record<string, unknown> = { role: { in: roles } };

    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { shop: { is: { name: { contains: searchTerm, mode: 'insensitive' } } } },
      ];
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
        shopName: user.shop.name,
        professionals,
        professionalsTotal: professionals.length,
        // new fields
        createdAt: user.createdAt,
        trialDaysRemaining: computeTrialDaysRemaining(user.createdAt, subscriptionStatus),
        hasPaidPlan: computeHasPaidPlan(userPlan),
        plan: {
          planId: userPlan?.planId ?? 'FREE',
          planName: userPlan?.plan?.name ?? 'Free',
          subscriptionStatus: userPlan?.subscriptionStatus ?? 'TRIAL',
          subscriptionId: userPlan?.subscriptionId ?? null,
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

export default router;
