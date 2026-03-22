import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../../utils/prisma';
import { hashPassword, comparePassword } from '../../utils/password';
import { signToken } from '../../utils/jwt';
import { AppError } from '../../utils/errors';
import { generateSlug, sanitizeSlug, validateSlug } from '../../utils/slug';
import { authMiddleware } from '../../middlewares/auth';

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
    const { owner, shop, professional } = req.body;

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

    const result = await prisma.$transaction(async (tx) => {
      const VALID_NICHES = ['barbearia', 'salao-beleza'];
      const niche = shop.niche && VALID_NICHES.includes(shop.niche) ? shop.niche : 'barbearia';

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
          address: newShop.address,
          phone: newShop.phone,
        },
      });

      const newProfessional = await tx.professional.create({
        data: {
          shopId: newShop.id,
          unitId: firstUnit.id,
          name: professional.name,
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
        },
      });

      return { shop: newShop, user: newUser };
    });

    res.status(201).json({
      message: 'Estabelecimento registrado com sucesso',
      shopId: result.shop.id,
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
    }

    // Sempre retorna 200 para não vazar informação sobre emails cadastrados
    res.json({ message: 'Se o email estiver cadastrado, você receberá as instruções em breve' });
  } catch (err) {
    next(err);
  }
});

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
