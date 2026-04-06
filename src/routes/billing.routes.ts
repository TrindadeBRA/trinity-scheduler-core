import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authorize } from '../middlewares/authorize';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL;

async function asaasRequest(method: string, path: string, body?: unknown) {
  if (!ASAAS_BASE_URL) throw new Error('ASAAS_BASE_URL não configurada');

  const url = `${ASAAS_BASE_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      'access_token': process.env.ASAAS_API_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    let parsed: { errors?: { code?: string; description?: string }[]; message?: string } = {};
    try { parsed = JSON.parse(text); } catch { /* noop */ }

    const firstError = parsed?.errors?.[0];
    const friendlyMessage = firstError?.description ?? parsed?.message ?? `Asaas API error ${res.status}`;

    console.error(`[billing] Asaas error: ${method} ${url} → ${res.status}`);
    throw new Error(friendlyMessage);
  }
  return res.json();
}

export function buildExternalReference(userId: string, planId: string): string {
  return `kronuz:${userId}:${planId}`;
}

export function buildPackageExternalReference(userId: string, planId: string): string {
  return `kronuz:package:${userId}:${planId}`;
}

export function parseExternalReference(ref: string): { isPackage: boolean; userId: string; planId: string } | null {
  if (!ref.startsWith('kronuz:')) return null;
  const parts = ref.split(':');
  if (parts[1] === 'package' && parts.length >= 4) {
    return { isPackage: true, userId: parts[2], planId: parts[3] };
  }
  if (parts.length >= 3) {
    return { isPackage: false, userId: parts[1], planId: parts[2] };
  }
  return null;
}

/**
 * @swagger
 * /billing/subscribe:
 *   post:
 *     tags: [Billing]
 *     summary: Criar assinatura direta via cartão de crédito no Asaas
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Assinatura criada com sucesso
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       502:
 *         description: Erro na API do Asaas
 */
router.post('/subscribe', authMiddleware, authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const {
      planId,
      name,
      cpfCnpj,
      email,
      phone,
      postalCode,
      creditCard,
      creditCardHolderInfo,
    } = req.body as {
      planId?: string;
      name?: string;
      cpfCnpj?: string;
      email?: string;
      phone?: string;
      postalCode?: string;
      addressNumber?: string;
      remoteIp?: string;
      creditCard?: {
        holderName?: string;
        number?: string;
        expiryMonth?: string;
        expiryYear?: string;
        ccv?: string;
      };
      creditCardHolderInfo?: {
        name?: string;
        email?: string;
        cpfCnpj?: string;
        postalCode?: string;
        addressNumber?: string;
        phone?: string;
      };
    };

    const missingTopLevel = (['planId', 'name', 'cpfCnpj', 'email', 'phone', 'postalCode', 'addressNumber', 'remoteIp'] as const)
      .find(field => !req.body[field]);
    if (missingTopLevel) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: `Campo ${missingTopLevel} é obrigatório` });
      return;
    }

    if (!creditCard) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Campo creditCard é obrigatório' });
      return;
    }
    const missingCardField = (['holderName', 'number', 'expiryMonth', 'expiryYear', 'ccv'] as const)
      .find(field => !creditCard[field]);
    if (missingCardField) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: `Campo creditCard.${missingCardField} é obrigatório` });
      return;
    }

    if (!creditCardHolderInfo) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Campo creditCardHolderInfo é obrigatório' });
      return;
    }
    const missingHolderField = (['name', 'email', 'cpfCnpj', 'postalCode', 'addressNumber', 'phone'] as const)
      .find(field => !creditCardHolderInfo[field]);
    if (missingHolderField) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: `Campo creditCardHolderInfo.${missingHolderField} é obrigatório` });
      return;
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId! } });
    if (!plan) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Plano não encontrado' });
      return;
    }

    const phoneDigits = (phone ?? '').replace(/\D/g, '');
    const cpfCnpjDigits = (cpfCnpj ?? '').replace(/\D/g, '');
    const postalCodeDigits = (postalCode ?? '').replace(/\D/g, '');
    const isMobile = phoneDigits.length === 11;

    let customer: { id: string };
    try {
      customer = await asaasRequest('POST', '/customers', {
        name,
        cpfCnpj: cpfCnpjDigits,
        email,
        phone: phoneDigits,
        ...(isMobile ? { mobilePhone: phoneDigits } : {}),
        postalCode: postalCodeDigits,
      }) as { id: string };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: 'ASAAS_ERROR', message });
      return;
    }

    const sanitizedCreditCard = {
      holderName: creditCard!.holderName!,
      number: (creditCard!.number ?? '').replace(/\D/g, ''),
      expiryMonth: creditCard!.expiryMonth!,
      expiryYear: creditCard!.expiryYear!,
      ccv: creditCard!.ccv!,
    };

    const holderCpfCnpjDigits = (creditCardHolderInfo!.cpfCnpj ?? '').replace(/\D/g, '');
    const holderPostalCodeDigits = (creditCardHolderInfo!.postalCode ?? '').replace(/\D/g, '');

    const subscriptionPayload = {
      customer: customer.id,
      billingType: 'CREDIT_CARD',
      value: plan.price / 100,
      nextDueDate: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
      cycle: 'MONTHLY',
      description: `Kronuz - Assinatura ${plan.id}`,
      externalReference: buildExternalReference(userId, planId!),
      creditCard: sanitizedCreditCard,
      creditCardHolderInfo: {
        name: creditCardHolderInfo!.name!,
        email: creditCardHolderInfo!.email!,
        cpfCnpj: holderCpfCnpjDigits,
        postalCode: holderPostalCodeDigits,
        addressNumber: creditCardHolderInfo!.addressNumber!,
        phone: phoneDigits,
        ...(isMobile ? { mobilePhone: phoneDigits } : {}),
      },
      remoteIp: req.body.remoteIp,
    };

    let sub: { id: string };
    try {
      sub = await asaasRequest('POST', '/subscriptions/', subscriptionPayload) as { id: string };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: 'ASAAS_ERROR', message });
      return;
    }

    await prisma.userPlan.upsert({
      where: { userId },
      update: { subscriptionId: sub.id, planId: planId!, subscriptionStatus: 'ACTIVE' },
      create: { userId, planId: planId!, subscriptionId: sub.id, subscriptionStatus: 'ACTIVE' },
    });

    res.json({ subscriptionId: sub.id });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /billing/package:
 *   post:
 *     tags: [Billing]
 *     summary: Comprar pacote mensal de 30 dias via Asaas (boleto, PIX ou cartão)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId, billingType, name, cpfCnpj, email, phone, postalCode, addressNumber]
 *             properties:
 *               planId:
 *                 type: string
 *               billingType:
 *                 type: string
 *                 enum: [BOLETO, CREDIT_CARD, PIX]
 *               name:
 *                 type: string
 *               cpfCnpj:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               postalCode:
 *                 type: string
 *               addressNumber:
 *                 type: string
 *               creditCard:
 *                 type: object
 *               creditCardHolderInfo:
 *                 type: object
 *     responses:
 *       200:
 *         description: Pacote criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 paymentId:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       502:
 *         description: Erro na API do Asaas
 */
router.post('/package', authMiddleware, authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const {
      planId,
      billingType,
      name,
      cpfCnpj,
      email,
      phone,
      postalCode,
      addressNumber,
      creditCard,
      creditCardHolderInfo,
    } = req.body as {
      planId?: string;
      billingType?: string;
      name?: string;
      cpfCnpj?: string;
      email?: string;
      phone?: string;
      postalCode?: string;
      addressNumber?: string;
      remoteIp?: string;
      creditCard?: {
        holderName?: string;
        number?: string;
        expiryMonth?: string;
        expiryYear?: string;
        ccv?: string;
      };
      creditCardHolderInfo?: {
        name?: string;
        email?: string;
        cpfCnpj?: string;
        postalCode?: string;
        addressNumber?: string;
        phone?: string;
      };
    };

    const missingField = (['planId', 'billingType', 'name', 'cpfCnpj', 'email', 'phone', 'postalCode', 'addressNumber'] as const)
      .find(field => !req.body[field]);
    if (missingField) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: `Campo ${missingField} é obrigatório` });
      return;
    }

    if (billingType === 'CREDIT_CARD') {
      if (!creditCard) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Campo creditCard é obrigatório' });
        return;
      }
      const missingCardField = (['holderName', 'number', 'expiryMonth', 'expiryYear', 'ccv'] as const)
        .find(field => !creditCard[field]);
      if (missingCardField) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: `Campo creditCard.${missingCardField} é obrigatório` });
        return;
      }

      if (!creditCardHolderInfo) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Campo creditCardHolderInfo é obrigatório' });
        return;
      }
      const missingHolderField = (['name', 'email', 'cpfCnpj', 'postalCode', 'addressNumber', 'phone'] as const)
        .find(field => !creditCardHolderInfo[field]);
      if (missingHolderField) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: `Campo creditCardHolderInfo.${missingHolderField} é obrigatório` });
        return;
      }
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId! } });
    if (!plan) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Plano não encontrado' });
      return;
    }

    const phoneDigits = (phone ?? '').replace(/\D/g, '');
    const cpfCnpjDigits = (cpfCnpj ?? '').replace(/\D/g, '');
    const postalCodeDigits = (postalCode ?? '').replace(/\D/g, '');

    let customer: { id: string };
    try {
      customer = await asaasRequest('POST', '/customers', {
        name,
        cpfCnpj: cpfCnpjDigits,
        email,
        phone: phoneDigits,
        postalCode: postalCodeDigits,
      }) as { id: string };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: 'ASAAS_ERROR', message });
      return;
    }

    const dueDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    const paymentPayload: Record<string, unknown> = {
      customer: customer.id,
      billingType,
      value: plan.packagePrice / 100,
      dueDate,
      description: `Kronuz - Pacote 30 dias - ${planId}`,
      externalReference: buildPackageExternalReference(userId, planId!),
    };

    if (billingType === 'CREDIT_CARD') {
      paymentPayload.creditCard = {
        holderName: creditCard!.holderName!,
        number: (creditCard!.number ?? '').replace(/\D/g, ''),
        expiryMonth: creditCard!.expiryMonth!,
        expiryYear: creditCard!.expiryYear!,
        ccv: creditCard!.ccv!,
      };
      paymentPayload.creditCardHolderInfo = {
        name: creditCardHolderInfo!.name!,
        email: creditCardHolderInfo!.email!,
        cpfCnpj: (creditCardHolderInfo!.cpfCnpj ?? '').replace(/\D/g, ''),
        postalCode: (creditCardHolderInfo!.postalCode ?? '').replace(/\D/g, ''),
        addressNumber: creditCardHolderInfo!.addressNumber!,
        phone: (creditCardHolderInfo!.phone ?? '').replace(/\D/g, ''),
      };
    }

    let payment: { id: string; invoiceUrl?: string; bankSlipUrl?: string; status?: string };
    try {
      payment = await asaasRequest('POST', '/payments', paymentPayload) as { id: string; invoiceUrl?: string; bankSlipUrl?: string; status?: string };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: 'ASAAS_ERROR', message });
      return;
    }

    // Para cartão de crédito, o pagamento é confirmado na hora — ativa o plano imediatamente.
    // Para PIX/Boleto, o pagamento fica pendente — o webhook PAYMENT_CONFIRMED ativará o plano.
    const isConfirmed = billingType === 'CREDIT_CARD' && (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED');

    if (isConfirmed) {
      const packageExpiresAt = new Date();
      packageExpiresAt.setDate(packageExpiresAt.getDate() + 30);

      await prisma.userPlan.upsert({
        where: { userId },
        update: { planId: planId!, isPackage: true, packageExpiresAt, subscriptionStatus: 'ACTIVE' },
        create: { userId, planId: planId!, isPackage: true, packageExpiresAt, subscriptionStatus: 'ACTIVE' },
      });
    }

    // Buscar dados de PIX se aplicável
    let pixData: { encodedImage?: string; payload?: string; expirationDate?: string } | undefined;
    if (billingType === 'PIX') {
      try {
        pixData = await asaasRequest('GET', `/payments/${payment.id}/pixQrCode`) as { encodedImage?: string; payload?: string; expirationDate?: string };
      } catch {
        // PIX QR code pode não estar disponível imediatamente, não bloquear
      }
    }

    res.json({
      paymentId: payment.id,
      status: isConfirmed ? 'CONFIRMED' : 'PENDING',
      ...(payment.invoiceUrl && { invoiceUrl: payment.invoiceUrl }),
      ...(payment.bankSlipUrl && { bankSlipUrl: payment.bankSlipUrl }),
      ...(pixData?.payload && { pixCopyPaste: pixData.payload }),
      ...(pixData?.encodedImage && { pixQrCodeBase64: pixData.encodedImage }),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /billing/subscriptions/{id}:
 *   delete:
 *     tags: [Billing]
 *     summary: Cancelar assinatura no Asaas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da assinatura no Asaas
 *     responses:
 *       200:
 *         description: Assinatura cancelada com sucesso
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete('/subscriptions/:id', authMiddleware, authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    await asaasRequest('DELETE', `/subscriptions/${id}`);

    await prisma.userPlan.updateMany({
      where: { userId, subscriptionId: id },
      data: { subscriptionStatus: 'INACTIVE' },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /billing/webhook:
 *   post:
 *     tags: [Billing]
 *     summary: Receber eventos de webhook do Asaas (público, validado por token)
 *     parameters:
 *       - in: header
 *         name: asaas-access-token
 *         schema:
 *           type: string
 *         description: Token de validação do webhook
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 enum: [PAYMENT_CONFIRMED, PAYMENT_OVERDUE, SUBSCRIPTION_DELETED]
 *               payment:
 *                 type: object
 *                 properties:
 *                   externalReference:
 *                     type: string
 *                   subscription:
 *                     type: string
 *               subscription:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   externalReference:
 *                     type: string
 *     responses:
 *       200:
 *         description: Evento processado (sempre 200 para evitar retry loop)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { event, payment, subscription } = req.body as {
      event: string;
      payment?: { externalReference?: string; subscription?: string };
      subscription?: { id?: string; externalReference?: string };
    };

    const externalReference = payment?.externalReference ?? subscription?.externalReference;

    const parsed = parseExternalReference(externalReference ?? '');
    if (parsed === null) {
      return res.status(200).json({ received: true });
    }

    if (parsed.isPackage) {
      const now = new Date();
      const packageExpiresAt = new Date(now);
      packageExpiresAt.setDate(packageExpiresAt.getDate() + 30);

      if (event === 'PAYMENT_CONFIRMED') {
        await prisma.userPlan.updateMany({
          where: { userId: parsed.userId },
          data: {
            planId: parsed.planId,
            isPackage: true,
            packageExpiresAt,
            subscriptionStatus: 'ACTIVE',
          },
        });
      } else if (event === 'PAYMENT_OVERDUE') {
        await prisma.userPlan.updateMany({
          where: { userId: parsed.userId },
          data: { subscriptionStatus: 'INACTIVE' },
        });
      }
    } else {
      // Subscription flow
      if (event === 'PAYMENT_CONFIRMED') {
        const subscriptionId = payment?.subscription ?? subscription?.id;
        await prisma.userPlan.updateMany({
          where: { userId: parsed.userId },
          data: {
            planId: parsed.planId,
            subscriptionStatus: 'ACTIVE',
            ...(subscriptionId ? { subscriptionId } : {}),
          },
        });
      } else if (event === 'PAYMENT_OVERDUE' || event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_INACTIVATED') {
        await prisma.userPlan.updateMany({
          where: { userId: parsed.userId },
          data: {
            subscriptionStatus: 'INACTIVE',
            ...(event === 'SUBSCRIPTION_DELETED' ? { planId: 'FREE', subscriptionId: null } : {}),
          },
        });
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(200).json({ received: true });
  }
});

export default router;
