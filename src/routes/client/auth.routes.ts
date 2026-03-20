import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Client Auth]
 *     summary: Autenticação do cliente por telefone
 *     description: Autentica ou cria um cliente pelo número de telefone. Retorna o clientId (UUID). Se o clientId já existir no localStorage do frontend, este endpoint pode ser pulado.
 *     parameters:
 *       - in: header
 *         name: X-Shop-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do estabelecimento
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Cliente autenticado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clientId:
 *                   type: string
 *                   format: uuid
 *       400:
 *         description: Campo phone ausente ou inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.body;
    const shopId = req.shopId;

    if (!phone || !phone.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Campo phone é obrigatório');
    }

    if (!shopId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'shopId não resolvido');
    }

    const client = await prisma.client.upsert({
      where: { shopId_phone: { shopId, phone: phone.trim() } },
      update: {},
      create: { shopId, phone: phone.trim() },
    });

    res.json({ clientId: client.id, name: client.name });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /auth/validate:
 *   get:
 *     tags: [Client Auth]
 *     summary: Validar clientId existente
 *     description: Valida se um clientId existe no banco. Usado pelo frontend para verificar se o cliente já está cadastrado antes de pedir o telefone.
 *     parameters:
 *       - in: header
 *         name: X-Shop-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID do cliente
 *     responses:
 *       200:
 *         description: Cliente válido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clientId:
 *                   type: string
 *                   format: uuid
 *                 name:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: clientId ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId } = req.query;

    if (!clientId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Query param clientId é obrigatório');
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId as string },
    });

    if (!client) {
      throw new AppError(404, 'NOT_FOUND', 'Cliente não encontrado');
    }

    res.json({ clientId: client.id, name: client.name });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /auth/name:
 *   patch:
 *     tags: [Client Auth]
 *     summary: Atualizar nome do cliente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientId, name]
 *             properties:
 *               clientId:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Nome atualizado
 *       400:
 *         description: Campos ausentes
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, name } = req.body;

    if (!clientId || !name?.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'clientId e name são obrigatórios');
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new AppError(404, 'NOT_FOUND', 'Cliente não encontrado');
    }

    await prisma.client.update({
      where: { id: clientId },
      data: { name: name.trim() },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
