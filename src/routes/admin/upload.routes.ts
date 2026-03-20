import { Router, Request, Response, NextFunction } from 'express';
import { authorize } from '../../middlewares/authorize';
import { generatePresignedUpload } from '../../utils/r2';
import { AppError } from '../../utils/errors';

const router = Router();

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ALLOWED_FOLDERS = ['services', 'professionals', 'shop'] as const;

/**
 * @swagger
 * /admin/upload/presign:
 *   post:
 *     tags: [Admin Upload]
 *     summary: Gerar URL pré-assinada para upload de imagem
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UploadPresignRequest'
 *     responses:
 *       200:
 *         description: URL pré-assinada gerada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadPresignResponse'
 *       400:
 *         description: contentType ou folder inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/upload/presign', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const { contentType, folder } = req.body;

    if (!contentType || !ALLOWED_TYPES.includes(contentType)) {
      throw new AppError(400, 'VALIDATION_ERROR', `contentType inválido. Permitidos: ${ALLOWED_TYPES.join(', ')}`);
    }

    if (!folder || !ALLOWED_FOLDERS.includes(folder)) {
      throw new AppError(400, 'VALIDATION_ERROR', `folder inválido. Permitidos: ${ALLOWED_FOLDERS.join(', ')}`);
    }

    const result = await generatePresignedUpload(shopId, folder, contentType);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
