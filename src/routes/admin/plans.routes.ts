import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { AppError } from '../../utils/errors';

// ─── Admin Plans router (mounted at /admin) ───────────────────────────────────

export const adminPlansRouter = Router();

/**
 * @swagger
 * /admin/plans:
 *   get:
 *     tags: [Admin Plans]
 *     summary: Listar todos os planos (apenas admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de todos os planos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Plan'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
adminPlansRouter.get('/plans', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { price: 'asc' },
    });
    res.json(plans);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/plans/{planId}:
 *   patch:
 *     tags: [Admin Plans]
 *     summary: Atualizar preço e/ou limites de um plano (apenas admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [FREE, PREMIUM, PRO, ADMIN]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlanUpdateInput'
 *     responses:
 *       200:
 *         description: Plano atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Plan'
 *       400:
 *         description: Nenhum campo para atualizar
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
adminPlansRouter.patch('/plans/:planId', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const planId = req.params.planId as string;
    const { price, unitLimit, professionalLimit, packagePrice } = req.body;

    const existing = await prisma.plan.findUnique({ where: { id: planId } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Plano não encontrado');

    const data: Record<string, number> = {};
    if (price !== undefined) data.price = price;
    if (unitLimit !== undefined) data.unitLimit = unitLimit;
    if (professionalLimit !== undefined) data.professionalLimit = professionalLimit;
    if (packagePrice !== undefined) data.packagePrice = packagePrice;

    if (Object.keys(data).length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Nenhum campo para atualizar');
    }

    const plan = await prisma.plan.update({ where: { id: planId }, data });
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

// ─── Public Plans router (mounted at /) ──────────────────────────────────────

export const plansRouter = Router();

/**
 * @swagger
 * /plans:
 *   get:
 *     tags: [Plans]
 *     summary: Listar planos visíveis (leader e admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de planos disponíveis
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Plan'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
plansRouter.get('/', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { price: 'asc' },
    });
    res.json(plans);
  } catch (err) {
    next(err);
  }
});


/**
 * @swagger
 * /plans/me:
 *   get:
 *     tags: [Plans]
 *     summary: Retornar o plano da shop do usuário autenticado
 *     description: >
 *       Para leader/admin retorna o próprio plano.
 *       Para professional retorna o plano do dono da shop (leader/admin).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Plano e status de assinatura
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserPlan'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
plansRouter.get('/me', authorize('leader', 'admin', 'professional'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let targetUserId = req.user!.id;

    if (req.user!.role === 'professional') {
      const shopId = req.shopId || req.user!.shopId;
      const owner = await prisma.user.findFirst({
        where: { shopId, role: { in: ['admin', 'leader'] } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!owner) {
        return res.json({ planId: 'FREE', subscriptionId: null, subscriptionStatus: 'TRIAL', isPackage: false, packageExpiresAt: null, createdAt: null });
      }
      targetUserId = owner.id;
    }

    const userPlan = await prisma.userPlan.findUnique({ where: { userId: targetUserId } });

    if (!userPlan) {
      const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { createdAt: true } });
      return res.json({ planId: 'FREE', subscriptionId: null, subscriptionStatus: 'TRIAL', isPackage: false, packageExpiresAt: null, createdAt: user?.createdAt ?? null });
    }

    res.json({
      planId: userPlan.planId,
      subscriptionId: userPlan.subscriptionId ?? null,
      subscriptionStatus: userPlan.subscriptionStatus,
      isPackage: userPlan.isPackage,
      packageExpiresAt: userPlan.packageExpiresAt ?? null,
      createdAt: userPlan.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /plans/me:
 *   post:
 *     tags: [Plans]
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
 */
plansRouter.post('/me', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { planId } = req.body;

    const isFree = planId === 'FREE';

    const userPlan = await prisma.userPlan.upsert({
      where: { userId },
      create: {
        userId,
        planId,
        ...(isFree ? { subscriptionStatus: 'TRIAL', subscriptionId: null } : {}),
      },
      update: {
        planId,
        ...(isFree ? { subscriptionStatus: 'TRIAL', subscriptionId: null } : {}),
      },
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
