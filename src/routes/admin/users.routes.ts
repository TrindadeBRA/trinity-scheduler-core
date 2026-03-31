import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { parsePagination, createPaginatedResponse } from '../../utils/pagination';

const router = Router();

/**
 * @swagger
 * /admin/users/me/plan:
 *   get:
 *     tags: [Admin Users - Plan]
 *     summary: Retornar o plano do usuário autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Plano e status de assinatura do usuário
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserPlan'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/users/me/plan', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const userPlan = await prisma.userPlan.findUnique({ where: { userId } });

    if (!userPlan) {
      return res.json({ planId: 'FREE', subscriptionId: null, subscriptionStatus: 'TRIAL' });
    }

    res.json({
      planId: userPlan.planId,
      subscriptionId: userPlan.subscriptionId ?? null,
      subscriptionStatus: userPlan.subscriptionStatus,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/users/me/plan:
 *   post:
 *     tags: [Admin Users - Plan]
 *     summary: Criar ou atualizar o plano do usuário autenticado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *             properties:
 *               planId:
 *                 type: string
 *                 enum: [FREE, PREMIUM, PRO, ADMIN]
 *     responses:
 *       200:
 *         description: Plano criado ou atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserPlan'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/users/me/plan', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { planId } = req.body;

    const userPlan = await prisma.userPlan.upsert({
      where: { userId },
      create: { userId, planId },
      update: { planId },
    });

    res.json({
      planId: userPlan.planId,
      subscriptionId: userPlan.subscriptionId ?? null,
      subscriptionStatus: userPlan.subscriptionStatus,
    });
  } catch (err) {
    next(err);
  }
});

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
          shop: { select: { id: true, name: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Busca profissionais de todos os shops de uma vez (evita N+1)
    // Apenas para leaders — admins não têm profissionais associados
    const leaderShopIds = [...new Set(
      leaders.filter(l => l.role === 'leader').map(l => l.shopId)
    )];

    const allProfessionals = leaderShopIds.length > 0
      ? await prisma.professional.findMany({
          where: { shopId: { in: leaderShopIds }, deletedAt: null },
          select: { id: true, shopId: true, name: true, email: true, phone: true, active: true },
          orderBy: { name: 'asc' },
        })
      : [];

    const profsByShop = allProfessionals.reduce<Record<string, typeof allProfessionals>>((acc, p) => {
      if (!acc[p.shopId]) acc[p.shopId] = [];
      acc[p.shopId].push(p);
      return acc;
    }, {});

    const data = leaders.map((user) => {
      const professionals = user.role === 'leader' ? (profsByShop[user.shopId] ?? []) : [];
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        shopName: user.shop.name,
        professionals,
        professionalsTotal: professionals.length,
      };
    });

    res.json(createPaginatedResponse(data, total, pageNum, pageSizeNum));
  } catch (err) {
    next(err);
  }
});

export default router;
