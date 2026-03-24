import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /client/units/resolve/{slug}:
 *   get:
 *     tags: [Client Units]
 *     summary: Resolve slug para obter shopId e unitId
 *     description: Endpoint público que não requer autenticação ou X-Shop-Id header. Resolve um slug de unidade para obter os IDs e nomes necessários.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug da unidade (case-insensitive)
 *         example: trinitybarber
 *     responses:
 *       200:
 *         description: Slug resolvido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unitId:
 *                   type: string
 *                   format: uuid
 *                   description: ID da unidade
 *                 shopId:
 *                   type: string
 *                   format: uuid
 *                   description: ID do estabelecimento
 *                 unitName:
 *                   type: string
 *                   description: Nome da unidade
 *                 shopName:
 *                   type: string
 *                   description: Nome do estabelecimento
 *             example:
 *               unitId: "123e4567-e89b-12d3-a456-426614174000"
 *               shopId: "123e4567-e89b-12d3-a456-426614174001"
 *               unitName: "Trinity Barber - Centro"
 *               shopName: "Trinity Barber Shop"
 *       404:
 *         description: Slug não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unidade não encontrada"
 */
router.get('/resolve/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = req.params.slug;
    
    // Garante que slug é uma string
    if (typeof slug !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Slug inválido');
    }
    
    // Normaliza slug para lowercase (case-insensitive lookup)
    const normalizedSlug = slug.toLowerCase();
    
    // Busca unidade no banco de dados com informações do shop
    const unit = await prisma.unit.findUnique({
      where: { slug: normalizedSlug },
      include: { 
        shop: { 
          select: { id: true, name: true } 
        } 
      }
    });
    
    if (!unit) {
      throw new AppError(404, 'NOT_FOUND', 'Unidade não encontrada');
    }

    const addressParts = [
      unit.street && unit.number ? `${unit.street}, ${unit.number}` : unit.street,
      unit.complement,
      unit.district,
      unit.city && unit.state ? `${unit.city} - ${unit.state}` : unit.city,
    ].filter(Boolean);

    res.json({
      unitId: unit.id,
      shopId: unit.shopId,
      unitName: unit.name,
      shopName: unit.shop.name,
      address: addressParts.length > 0 ? addressParts.join(', ') : null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
