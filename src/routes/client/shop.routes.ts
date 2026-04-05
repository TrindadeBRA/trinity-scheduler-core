import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /shop/info:
 *   get:
 *     tags: [Client Shop]
 *     summary: Obter informações públicas do estabelecimento
 *     description: Retorna o nome e nicho do estabelecimento. Se unitId for informado, retorna o nome, nicho e endereço formatado da unidade.
 *     parameters:
 *       - in: header
 *         name: X-Shop-Id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: unitId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Se informado, retorna dados da unidade em vez do estabelecimento
 *     responses:
 *       200:
 *         description: Informações do estabelecimento ou unidade
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   description: Nome do estabelecimento ou unidade
 *                 niche:
 *                   type: string
 *                   description: "Nicho do estabelecimento (ex: barbearia, salao-beleza)"
 *                 address:
 *                   type: string
 *                   nullable: true
 *                   description: Endereço completo formatado (apenas quando unitId fornecido)
 *       400:
 *         description: shopId não resolvido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não resolvido');

    const { unitId } = req.query;

    if (unitId) {
      const unit = await prisma.unit.findFirst({
        where: { id: unitId as string, shopId },
        select: {
          name: true,
          street: true, number: true, complement: true,
          district: true, city: true, state: true,
          shop: { select: { niche: true, logoUrl: true } },
        },
      });
      if (unit) {
        const addressParts = [
          unit.street && unit.number ? `${unit.street}, ${unit.number}` : unit.street,
          unit.complement,
          unit.district,
          unit.city && unit.state ? `${unit.city} - ${unit.state}` : unit.city,
        ].filter(Boolean);

        return res.json({
          name: unit.name,
          niche: unit.shop.niche,
          logoUrl: unit.shop.logoUrl,
          address: addressParts.length > 0 ? addressParts.join(', ') : null,
        });
      }
    }

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { name: true, niche: true, logoUrl: true },
    });

    if (!shop) throw new AppError(404, 'NOT_FOUND', 'Estabelecimento não encontrado');

    res.json(shop);
  } catch (err) {
    next(err);
  }
});

export default router;
