import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /admin/professionals:
 *   get:
 *     tags: [Admin Professionals]
 *     summary: Listar profissionais
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *                 $ref: '#/components/schemas/Professional'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/professionals', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    const { unitId } = req.query;

    const where: Record<string, unknown> = {};
    if (shopId && req.user?.role !== 'admin') where.shopId = shopId;
    if (unitId) where.unitId = unitId;

    const professionals = await prisma.professional.findMany({
      where,
      include: { workingHours: true },
      orderBy: { name: 'asc' },
    });

    res.json(professionals);
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

    const where: Record<string, unknown> = { id };
    if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

    const professional = await prisma.professional.findFirst({
      where,
      include: { workingHours: true },
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
router.post('/professionals', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const { name, unitId, avatar, specialties, phone, email, active, workingHours } = req.body;

    if (!name) throw new AppError(400, 'VALIDATION_ERROR', 'Campo name é obrigatório');

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
      include: { workingHours: true },
    });

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
    const { id } = req.params;
    const shopId = req.shopId || req.user?.shopId;

    // Professional só pode editar o próprio registro
    if (req.user?.role === 'professional' && req.user.professionalId !== id) {
      throw new AppError(403, 'FORBIDDEN', 'Profissional só pode editar o próprio registro');
    }

    const where: Record<string, unknown> = { id };
    if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

    const existing = await prisma.professional.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Profissional não encontrado');

    const { name, unitId, avatar, specialties, phone, email, active, workingHours } = req.body;

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
      include: { workingHours: true },
    });

    res.json(professional);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/professionals/{id}:
 *   delete:
 *     tags: [Admin Professionals]
 *     summary: Excluir profissional
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
    const { id } = req.params;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id };
    if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

    const existing = await prisma.professional.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Profissional não encontrado');

    await prisma.professional.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
