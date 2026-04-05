import { Router, Request, Response } from 'express';
import { VALID_NICHES, NICHE_DISPLAY_NAMES, NICHE_SKIN_MAP } from './admin/shop.routes';

const router = Router();

/**
 * @swagger
 * /public/niches:
 *   get:
 *     tags: [Public]
 *     summary: Listar nichos disponíveis (rota pública)
 *     responses:
 *       200:
 *         description: Lista de nichos disponíveis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 niches:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       displayName:
 *                         type: string
 */
router.get('/niches', async (req: Request, res: Response) => {
  res.json({
    niches: VALID_NICHES.map(id => ({
      id,
      displayName: NICHE_DISPLAY_NAMES[id],
      skin: NICHE_SKIN_MAP[id],
    }))
  });
});

export default router;
