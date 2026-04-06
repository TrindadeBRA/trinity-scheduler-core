import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /admin/referrals:
 *   get:
 *     tags: [Admin Referrals]
 *     summary: Listar referências (paginado)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca case-insensitive por code
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
 *     responses:
 *       200:
 *         description: Lista paginada de referências
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Referral'
 *                 total:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/referrals', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, page = '1', perPage = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const perPageNum = parseInt(perPage as string, 10);
    const skip = (pageNum - 1) * perPageNum;

    const where = search
      ? { code: { contains: search as string, mode: 'insensitive' as const } }
      : {};

    const [data, total] = await prisma.$transaction([
      prisma.referral.findMany({ where, skip, take: perPageNum, orderBy: { createdAt: 'desc' } }),
      prisma.referral.count({ where }),
    ]);

    res.json({ data, total });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/referrals/{id}:
 *   get:
 *     tags: [Admin Referrals]
 *     summary: Obter referência por ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Referência encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Referral'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/referrals/:id', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const referral = await prisma.referral.findUnique({ where: { id } });
    if (!referral) throw new AppError(404, 'NOT_FOUND', 'Referência não encontrada');
    res.json(referral);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/referrals:
 *   post:
 *     tags: [Admin Referrals]
 *     summary: Criar referência
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, commissionType, commissionValue]
 *             properties:
 *               code:
 *                 type: string
 *               commissionType:
 *                 type: string
 *                 enum: [percentage, fixed]
 *               commissionValue:
 *                 type: number
 *                 description: Centavos para fixed, inteiro para percentage
 *     responses:
 *       201:
 *         description: Referência criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Referral'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: Code já cadastrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/referrals', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, commissionType, commissionValue } = req.body;

    if (!code || !commissionType || commissionValue === undefined) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Campos code, commissionType e commissionValue são obrigatórios');
    }

    const normalizedCode = (code as string).toLowerCase();

    const existing = await prisma.referral.findUnique({ where: { code: normalizedCode } });
    if (existing) throw new AppError(409, 'CONFLICT', 'Code já cadastrado');

    const parsedValue = parseInt(commissionValue, 10);
    if (isNaN(parsedValue) || parsedValue < 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'commissionValue deve ser um inteiro positivo (centavos para fixed, inteiro para percentage)');
    }

    const referral = await prisma.referral.create({
      data: { code: normalizedCode, commissionType, commissionValue: parsedValue },
    });

    res.status(201).json(referral);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/referrals/{id}:
 *   put:
 *     tags: [Admin Referrals]
 *     summary: Atualizar referência
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *               commissionType:
 *                 type: string
 *               commissionValue:
 *                 type: number
 *     responses:
 *       200:
 *         description: Referência atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Referral'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Code já em uso por outra referência
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/referrals/:id', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { code, commissionType, commissionValue } = req.body;

    const existing = await prisma.referral.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Referência não encontrada');

    const updateData: { code?: string; commissionType?: string; commissionValue?: number } = {};

    if (code !== undefined) {
      const normalizedCode = (code as string).toLowerCase();
      const conflict = await prisma.referral.findFirst({
        where: { code: normalizedCode, NOT: { id } },
      });
      if (conflict) throw new AppError(409, 'CONFLICT', 'Code já em uso por outra referência');
      updateData.code = normalizedCode;
    }

    if (commissionType !== undefined) updateData.commissionType = commissionType;
    if (commissionValue !== undefined) {
      const parsedValue = parseInt(commissionValue, 10);
      if (isNaN(parsedValue) || parsedValue < 0) {
        throw new AppError(400, 'VALIDATION_ERROR', 'commissionValue deve ser um inteiro positivo');
      }
      updateData.commissionValue = parsedValue;
    }

    const referral = await prisma.referral.update({ where: { id }, data: updateData });
    res.json(referral);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/referrals/{id}:
 *   delete:
 *     tags: [Admin Referrals]
 *     summary: Excluir referência
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Referência excluída
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/referrals/:id', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.referral.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Referência não encontrada');
    await prisma.referral.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
