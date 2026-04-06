import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../../utils/prisma';
import { hashPassword, comparePassword } from '../../utils/password';
import { signToken } from '../../utils/jwt';
import { AppError } from '../../utils/errors';
import { generateSlug, sanitizeSlug, validateSlug } from '../../utils/slug';
import { authMiddleware } from '../../middlewares/auth';
import { sendWelcomeLeader, sendPasswordResetEmail } from '../../utils/email';
import { env } from '../../config/env';
import { VALID_NICHES, NICHE_SKIN_MAP } from './shop.routes';

const router = Router();

/**
 * @swagger
 * /admin/auth/login:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Login do administrador
 *     description: Autentica um usuário admin/leader/professional com email e senha. Retorna JWT.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminLoginRequest'
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminLoginResponse'
 *       400:
 *         description: Campos obrigatórios ausentes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Email e senha são obrigatórios');
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { professional: true },
    });

    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Email ou senha inválidos');
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'UNAUTHORIZED', 'Email ou senha inválidos');
    }

    const token = signToken({
      id: user.id,
      shopId: user.shopId,
      role: user.role as 'admin' | 'leader' | 'professional',
      professionalId: user.professionalId || undefined,
    });

    res.json({
      user: {
        name: user.name,
        email: user.email,
        avatar: user.professional?.avatar || null,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/auth/register:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Registrar novo estabelecimento
 *     description: Cria um novo leader, shop e professional em uma transação atômica.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Estabelecimento registrado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 shopId:
 *                   type: string
 *                   format: uuid
 *       400:
 *         description: Campos obrigatórios ausentes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Email já cadastrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { owner, shop, professional, ref } = req.body;

    if (!owner?.name || !owner?.email || !owner?.password) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados do proprietário são obrigatórios (name, email, password)');
    }
    if (!shop?.name) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Nome do estabelecimento é obrigatório');
    }
    if (!professional?.name) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Nome do profissional é obrigatório');
    }

    const passwordHash = await hashPassword(owner.password);

    // Resolve referral antes da transação
    let referralId: string | undefined;
    if (ref) {
      const referral = await prisma.referral.findFirst({ where: { code: (ref as string).toLowerCase() } });
      if (referral) referralId = referral.id;
    }

    const result = await prisma.$transaction(async (tx) => {
      const niche = shop.niche && VALID_NICHES.includes(shop.niche as typeof VALID_NICHES[number]) ? shop.niche : 'barbearia';

      const newShop = await tx.shop.create({
        data: {
          name: shop.name,
          phone: shop.phone || null,
          email: shop.email || null,
          address: shop.address || null,
          niche,
        },
      });

      // Cria horários de funcionamento padrão (seg-sáb 09:00-18:00)
      const defaultDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      await Promise.all([
        ...defaultDays.map((day) =>
          tx.shopHour.create({ data: { shopId: newShop.id, day, start: '09:00', end: '18:00' } })
        ),
        tx.shopHour.create({ data: { shopId: newShop.id, day: 'Domingo', start: null, end: null } }),
      ]);

      // Cria a primeira unidade automaticamente com os dados do shop
      // Gera ou valida slug
      let unitSlug = shop.slug ? sanitizeSlug(shop.slug) : generateSlug(newShop.name);
      
      // Valida o slug
      const slugValidation = validateSlug(unitSlug);
      if (!slugValidation.valid) {
        throw new AppError(400, 'VALIDATION_ERROR', slugValidation.error || 'Slug inválido');
      }
      
      // Verifica unicidade do slug
      const existingSlug = await tx.unit.findFirst({
        where: { slug: { equals: unitSlug, mode: 'insensitive' } }
      });
      
      if (existingSlug) {
        // Se houver conflito, adiciona sufixo numérico
        let counter = 2;
        let alternativeSlug = `${unitSlug}-${counter}`;
        while (await tx.unit.findFirst({ where: { slug: { equals: alternativeSlug, mode: 'insensitive' } } })) {
          counter++;
          alternativeSlug = `${unitSlug}-${counter}`;
        }
        unitSlug = alternativeSlug;
      }
      
      const firstUnit = await tx.unit.create({
        data: {
          shopId: newShop.id,
          name: newShop.name,
          slug: unitSlug,
          phone: shop.phone || null,
          zipcode: shop.zipcode || null,
          street: shop.street || null,
          number: shop.number || null,
          complement: shop.complement || null,
          district: shop.district || null,
          city: shop.city || null,
          state: shop.state || null,
        },
      });

      const newProfessional = await tx.professional.create({
        data: {
          shopId: newShop.id,
          unitId: firstUnit.id,
          name: professional.name,
          phone: professional.isOwner ? (owner.phone || null) : (professional.phone || null),
          avatar: professional.avatar || null,
          specialties: professional.specialties || [],
          workingHours: {
            create: defaultDays.map((day) => ({
              day,
              start: '09:00',
              end: '18:00',
              lunchStart: '12:00',
              lunchEnd: '13:00',
            })),
          },
        },
      });

      const newUser = await tx.user.create({
        data: {
          shopId: newShop.id,
          name: owner.name,
          email: owner.email,
          passwordHash,
          role: 'leader',
          professionalId: newProfessional.id,
          ...(referralId && { referralId }),
        },
      });

      // Cria UserPlan FREE automaticamente para o novo leader
      await tx.userPlan.create({
        data: {
          userId: newUser.id,
          planId: 'FREE',
          subscriptionStatus: 'TRIAL',
        },
      });

      return { shop: newShop, user: newUser };
    });

    res.status(201).json({
      message: 'Estabelecimento registrado com sucesso',
      shopId: result.shop.id,
    });

    // Envia email de boas-vindas ao leader (fire-and-forget — não bloqueia a resposta)
    sendWelcomeLeader(owner.email, {
      name: owner.name,
      shopName: result.shop.name,
      niche: result.shop.niche,
    }).catch((err) => {
      console.error('[REGISTER] Falha ao enviar email de boas-vindas:', err);
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/auth/forgot-password:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Solicitar redefinição de senha
 *     description: Gera um token de redefinição de senha com validade de 1 hora. Retorna 200 mesmo para emails não cadastrados (segurança).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Solicitação processada (independente de o email existir)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Email ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Email é obrigatório');
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const resetToken = crypto.randomUUID();
      const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExp },
      });

      sendPasswordResetEmail(user.email, {
        name: user.name,
        resetUrl: `${env.ADMIN_URL}/reset-password?token=${resetToken}`,
      }).catch((err) => console.error('[FORGOT-PASSWORD] Falha ao enviar email:', err));
    }

    // Sempre retorna 200 para não vazar informação sobre emails cadastrados
    res.json({ message: 'Se o email estiver cadastrado, você receberá as instruções em breve' });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/auth/reset-password:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Redefinir senha com token
 *     description: Valida o token de redefinição, verifica complexidade da senha e atualiza o passwordHash. Limpa o token após uso.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Senha redefinida com sucesso
 *       400:
 *         description: Token inválido/expirado ou senha fraca
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Token e senha são obrigatórios');
    }

    const user = await prisma.user.findFirst({ where: { resetToken: token } });

    if (!user || !user.resetTokenExp || user.resetTokenExp <= new Date()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Token inválido ou expirado');
    }

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^\w\s]/.test(password);
    const hasLength = password.length >= 8;

    if (!hasLower || !hasUpper || !hasDigit || !hasSpecial || !hasLength) {
      throw new AppError(400, 'VALIDATION_ERROR', 'A senha não atende todos os requisitos');
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExp: null },
    });

    res.json({ message: 'Senha redefinida com sucesso' });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/auth/me:
 *   get:
 *     tags: [Admin Auth]
 *     summary: Obter dados do usuário autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *                   nullable: true
 *                 role:
 *                   type: string
 *                   enum: [admin, leader, professional]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { professional: true },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'Usuário não encontrado');
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.professional?.phone ?? null,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/auth/profile:
 *   patch:
 *     tags: [Admin Auth]
 *     summary: Atualizar perfil do usuário autenticado
 *     description: Atualiza nome, telefone e/ou senha. Senha deve ter mínimo 8 caracteres com maiúscula, minúscula, número e caractere especial.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *               phone:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 description: Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial
 *     responses:
 *       200:
 *         description: Perfil atualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *                   nullable: true
 *                 role:
 *                   type: string
 *       400:
 *         $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/profile', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, newPassword } = req.body;

    if (name !== undefined && name.length < 2) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Nome deve ter no mínimo 2 caracteres');
    }

    if (newPassword !== undefined) {
      const hasLower = /[a-z]/.test(newPassword);
      const hasUpper = /[A-Z]/.test(newPassword);
      const hasDigit = /\d/.test(newPassword);
      const hasSpecial = /[^\w\s]/.test(newPassword);
      const hasLength = newPassword.length >= 8;

      if (!hasLower || !hasUpper || !hasDigit || !hasSpecial || !hasLength) {
        throw new AppError(400, 'VALIDATION_ERROR', 'A senha não atende todos os requisitos');
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { professional: true },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'Usuário não encontrado');
    }

    const userUpdateData: { name?: string; passwordHash?: string } = {};

    if (name !== undefined) {
      userUpdateData.name = name;
    }

    if (newPassword !== undefined) {
      userUpdateData.passwordHash = await hashPassword(newPassword);
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: userUpdateData,
      include: { professional: true },
    });

    if (phone !== undefined && user.professionalId) {
      await prisma.professional.update({
        where: { id: user.professionalId },
        data: { phone },
      });
    }

    const finalPhone = phone !== undefined && user.professionalId
      ? phone
      : updatedUser.professional?.phone ?? null;

    res.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: finalPhone,
      role: updatedUser.role,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
