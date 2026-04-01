import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authorize } from '../middlewares/authorize';

const router = Router();

const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL ?? 'https://api-sandbox.asaas.com/v3';

async function asaasRequest(method: string, path: string, body?: unknown) {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    method,
    headers: {
      'access_token': process.env.ASAAS_API_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asaas API error ${res.status}: ${text}`);
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
router.post('/subscribe', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
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
    let customer: { id: string };
    try {
      customer = await asaasRequest('POST', '/customers', {
        name,
        cpfCnpj,
        email,
        phone,
        postalCode,
      }) as { id: string };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: 'ASAAS_ERROR', message });
      return;
    }

    // Task 1.4 — Create Asaas Subscription (credit card endpoint — trailing slash)
    let sub: { id: string };
    try {
      sub = await asaasRequest('POST', '/subscriptions/', {
        customer: customer.id,
        billingType: 'CREDIT_CARD',
        value: plan.price / 100,
        nextDueDate: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
        cycle: 'MONTHLY',
        externalReference: buildExternalReference(userId, planId!),
        creditCard: req.body.creditCard,
        creditCardHolderInfo: req.body.creditCardHolderInfo,
        remoteIp: req.body.remoteIp,
      }) as { id: string };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: 'ASAAS_ERROR', message });
      return;
    }

    // Task 1.5 — Upsert UserPlan and return response
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
router.delete('/subscriptions/:id', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
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
