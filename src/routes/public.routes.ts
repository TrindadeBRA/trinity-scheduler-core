import { Router, Request, Response } from 'express';

const router = Router();

// Niche validation constants (deve estar sincronizado com admin/shop.routes.ts)
const VALID_NICHES = ['barbearia', 'salao-beleza'] as const;

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
  const nicheMap: Record<string, string> = {
    'barbearia': 'Barbearia',
    'salao-beleza': 'Salão de Beleza'
  };

  res.json({
    niches: VALID_NICHES.map(id => ({
      id,
      displayName: nicheMap[id] || id
    }))
  });
});

export default router;
