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

    const searchTerm = search as string | undefined;

    // Busca leaders com seus shops e profissionais
    const where: Record<string, unknown> = { role: 'leader' };

    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { shop: { name: { contains: searchTerm, mode: 'insensitive' } } },
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
          shop: {
            select: { name: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Para cada leader, busca os profissionais do shop
    const data = await Promise.all(
      leaders.map(async (leader) => {
        const professionals = await prisma.professional.findMany({
          where: { shopId: leader.shopId, deletedAt: null },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            active: true,
          },
          orderBy: { name: 'asc' },
        });

        return {
          id: leader.id,
          name: leader.name,
          email: leader.email,
          shopName: leader.shop.name,
          professionals,
          professionalsTotal: professionals.length,
        };
      })
    );

    res.json(createPaginatedResponse(data, total, pageNum, pageSizeNum));
  } catch (err) {
    next(err);
  }
});

export default router;
