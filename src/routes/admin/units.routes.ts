import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { AppError } from '../../utils/errors';
import { parsePagination, createPaginatedResponse } from '../../utils/pagination';
import { sanitizeSlug, validateSlug, generateSlug } from '../../utils/slug';

const router = Router();

/**
 * @swagger
 * /admin/units:
 *   get:
 *     tags: [Admin Units]
 *     summary: Listar unidades (paginado)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por nome, endereço ou telefone
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
 *           enum: [name, address, phone]
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
 *         description: Lista paginada de unidades
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Unit'
 *                 total:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/units', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    const { search, page = '1', pageSize = '25', sortBy = 'name', sortOrder = 'asc' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const perPageNum = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * perPageNum;

    const where: Record<string, unknown> = {};
    if (shopId) where.shopId = shopId;

    // Professional só vê as unidades às quais está vinculado
    if (req.user?.role === 'professional' && req.user.professionalId) {
      const allocations = await prisma.professionalUnit.findMany({
        where: { professionalId: req.user.professionalId },
        select: { unitId: true },
      });
      const unitIds = allocations.map((a) => a.unitId);

      // Inclui também o unitId legado do profissional
      const professional = await prisma.professional.findUnique({
        where: { id: req.user.professionalId },
        select: { unitId: true },
      });
      if (professional?.unitId && !unitIds.includes(professional.unitId)) {
        unitIds.push(professional.unitId);
      }

      where.id = { in: unitIds };
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { street: { contains: search as string, mode: 'insensitive' } },
        { city: { contains: search as string, mode: 'insensitive' } },
        { district: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const allowedSortFields = ['name', 'address', 'phone'];
    const field = allowedSortFields.includes(sortBy as string) ? (sortBy as string) : 'name';
    const direction = sortOrder === 'asc' ? 'asc' : 'desc';

    const [data, total] = await prisma.$transaction([
      prisma.unit.findMany({ where, skip, take: perPageNum, orderBy: { [field]: direction } }),
      prisma.unit.count({ where }),
    ]);

    res.json({ data, total });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/units/{id}:
 *   get:
 *     tags: [Admin Units]
 *     summary: Obter unidade por ID
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
 *         description: Unidade encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Unit'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/units/:id', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id };
    if (shopId) where.shopId = shopId;

    const unit = await prisma.unit.findFirst({ where });
    if (!unit) throw new AppError(404, 'NOT_FOUND', 'Unidade não encontrada');

    res.json(unit);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/units:
 *   post:
 *     tags: [Admin Units]
 *     summary: Criar unidade
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *                 description: Slug opcional para URL (será gerado automaticamente se não fornecido)
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Unidade criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Unit'
 *       400:
 *         description: Erro de validação
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: Slug já está em uso
 */
router.post('/units', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const { name, phone, slug, zipcode, street, number, complement, district, city, state } = req.body;
    if (!name) throw new AppError(400, 'VALIDATION_ERROR', 'Campo name é obrigatório');

    // Sanitiza e valida slug se fornecido, ou gera automaticamente
    let finalSlug = slug ? sanitizeSlug(slug) : generateSlug(name);
    
    const validation = validateSlug(finalSlug);
    if (!validation.valid) {
      throw new AppError(400, 'VALIDATION_ERROR', validation.error || 'Slug inválido');
    }
    
    // Verifica unicidade (case-insensitive)
    const existing = await prisma.unit.findFirst({
      where: { slug: { equals: finalSlug, mode: 'insensitive' } }
    });
    
    if (existing) {
      throw new AppError(409, 'CONFLICT', 'Slug já está em uso');
    }

    const unit = await prisma.unit.create({
      data: { 
        shopId, 
        name, 
        slug: finalSlug,
        phone: phone || null,
        zipcode: zipcode || null,
        street: street || null,
        number: number || null,
        complement: complement || null,
        district: district || null,
        city: city || null,
        state: state || null,
      },
    });

    res.status(201).json(unit);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/units/{id}:
 *   put:
 *     tags: [Admin Units]
 *     summary: Atualizar unidade
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
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *                 description: Slug opcional para URL
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Unidade atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Unit'
 *       400:
 *         description: Erro de validação
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Slug já está em uso
 */
router.put('/units/:id', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id };
    if (shopId) where.shopId = shopId;

    const existing = await prisma.unit.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Unidade não encontrada');

    const { name, phone, slug, zipcode, street, number, complement, district, city, state } = req.body;

    // Se slug foi fornecido, sanitiza e valida
    if (slug !== undefined) {
      const sanitized = sanitizeSlug(slug);
      const validation = validateSlug(sanitized);
      
      if (!validation.valid) {
        throw new AppError(400, 'VALIDATION_ERROR', validation.error || 'Slug inválido');
      }
      
      // Verifica unicidade excluindo a própria unidade (case-insensitive)
      const conflicting = await prisma.unit.findFirst({
        where: {
          slug: { equals: sanitized, mode: 'insensitive' },
          id: { not: id }
        }
      });
      
      if (conflicting) {
        throw new AppError(409, 'CONFLICT', 'Slug já está em uso');
      }
    }

    const unit = await prisma.unit.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug: sanitizeSlug(slug) }),
        ...(phone !== undefined && { phone }),
        ...(zipcode !== undefined && { zipcode }),
        ...(street !== undefined && { street }),
        ...(number !== undefined && { number }),
        ...(complement !== undefined && { complement }),
        ...(district !== undefined && { district }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
      },
    });

    res.json(unit);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/units/{id}:
 *   delete:
 *     tags: [Admin Units]
 *     summary: Excluir unidade
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
 *         description: Unidade excluída
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/units/:id', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id };
    if (shopId) where.shopId = shopId;

    const existing = await prisma.unit.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Unidade não encontrada');

    await prisma.unit.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
