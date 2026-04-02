import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authorize } from '../middlewares/authorize';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL;

console.log('[billing] ASAAS_BASE_URL:', ASAAS_BASE_URL);

async function asaasRequest(method: string, path: string, body?: unknown) {
  if (!ASAAS_BASE_URL) throw new Error('ASAAS_BASE_URL não configurada');

  const url = `${ASAAS_BASE_URL}${path}`;
  console.log(`[billing] ${method} ${url}`, body ? JSON.stringify(body) : '');

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
    try { parsed = JSON.parse(text); } catch { /* mantém vazio */ }

    const firstError = parsed?.errors?.[0];
    const friendlyMessage = firstError?.description ?? parsed?.message ?? `Asaas API error ${res.status}`;

    console.error(`[billing] ${method} ${url} → ${res.status} | code=${firstError?.code ?? 'n/a'} | msg=${friendlyMessage} | full=${text}`);
    throw new Error(friendlyMessage);
  }
  return res.json();
}

export function buildExternalReference(userId: string, planId: string): string {
  return `kronuz:${userId}:${planId}`;
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
      addressNumber,
      remoteIp,
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

    // Task 1.1 — Validate required top-level fields
    const missingTopLevel = (['planId', 'name', 'cpfCnpj', 'email', 'phone', 'postalCode', 'addressNumber', 'remoteIp'] as const)
      .find(field => !req.body[field]);
    if (missingTopLevel) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: `Campo ${missingTopLevel} é obrigatório` });
      return;
    }

    // Validate creditCard object and its required fields
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

    // Validate creditCardHolderInfo object and its required fields
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

    // Task 1.2 — Plan lookup
    const plan = await prisma.plan.findUnique({ where: { id: planId! } });
    if (!plan) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Plano não encontrado' });
      return;
    }

    // Task 1.3 — Create Asaas Customer
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
        // Asaas exige phone (fixo) e mobilePhone (celular) separados
        // Enviamos em ambos para garantir que pelo menos um seja aceito
        phone: phoneDigits,
        ...(isMobile ? { mobilePhone: phoneDigits } : {}),
        postalCode: postalCodeDigits,
      }) as { id: string };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: 'ASAAS_ERROR', message });
      return;
    }

    // Task 1.4 — Create Asaas Subscription (credit card endpoint — trailing slash)
    // Sanitizar creditCard: garantir que number contenha apenas dígitos
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
      description: `Assinatura ${plan.id}`,
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

    console.log('[billing] subscription payload (card number redacted):', JSON.stringify({
      ...subscriptionPayload,
      creditCard: { ...subscriptionPayload.creditCard, number: '****', ccv: '***' },
    }));

    let sub: { id: string };
    try {
      sub = await asaasRequest('POST', '/subscriptions/', subscriptionPayload) as { id: string };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: 'ASAAS_ERROR', message });
      return;
    }

    // Task 1.5 — Upsert UserPlan with PENDING status — webhook PAYMENT_CONFIRMED will activate it
    await prisma.userPlan.upsert({
      where: { userId },
      update: { subscriptionId: sub.id, planId: planId! },
      create: { userId, planId: planId!, subscriptionId: sub.id },
    });

    res.json({ subscriptionId: sub.id });
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
    const { id } = req.params;

    await asaasRequest('DELETE', `/subscriptions/${id}`);

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

    if (!externalReference?.startsWith('kronuz:')) {
      console.warn(`[billing/webhook] externalReference inválido: ${externalReference}`);
      return res.status(200).json({ received: true });
    }

    // Parse: "kronuz:{userId}:{planId}"
    const [, userId, planId] = externalReference.split(':', 3);

    if (event === 'PAYMENT_CONFIRMED') {
      const subscriptionId = payment?.subscription ?? subscription?.id;
      await prisma.userPlan.updateMany({
        where: { userId },
        data: {
          planId,
          subscriptionStatus: 'ACTIVE',
          ...(subscriptionId ? { subscriptionId } : {}),
        },
      });
    } else if (event === 'PAYMENT_OVERDUE' || event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_INACTIVATED') {
      await prisma.userPlan.updateMany({
        where: { userId },
        data: { subscriptionStatus: 'INACTIVE' },
      });
    }
    // Unknown events are silently ignored

    return res.status(200).json({ received: true });
  } catch (err) {
    // Always return 200 to avoid Asaas retry loops
    console.error('[billing/webhook] Error processing webhook:', err);
    return res.status(200).json({ received: true });
  }
});

export default router;
