import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { parsePagination, createPaginatedResponse } from '../../utils/pagination';

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
    const { search, page, pageSize } = req.query;
    const { skip, take, page: pageNum, pageSize: pageSizeNum } = parsePagination({
      page: page as string,
      pageSize: pageSize as string,
    });

    const searchTerm = (search as string | undefined)?.trim();

    const where: Record<string, unknown> = { role: 'leader' };

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
          shopId: true,
          shop: { select: { id: true, name: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Busca profissionais de todos os shops de uma vez (evita N+1)
    const shopIds = [...new Set(leaders.map((l) => l.shopId))];

    const allProfessionals = shopIds.length > 0
      ? await prisma.professional.findMany({
          where: { shopId: { in: shopIds }, deletedAt: null },
          select: { id: true, shopId: true, name: true, email: true, phone: true, active: true },
          orderBy: { name: 'asc' },
        })
      : [];

    // Agrupa profissionais por shopId
    const profsByShop = allProfessionals.reduce<Record<string, typeof allProfessionals>>((acc, p) => {
      if (!acc[p.shopId]) acc[p.shopId] = [];
      acc[p.shopId].push(p);
      return acc;
    }, {});

    const data = leaders.map((leader) => {
      const professionals = profsByShop[leader.shopId] ?? [];
      return {
        id: leader.id,
        name: leader.name,
        email: leader.email,
        shopName: leader.shop.name,
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
