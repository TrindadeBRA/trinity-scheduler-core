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

/**
 * @swagger
 * /billing/checkout:
 *   post:
 *     tags: [Billing]
 *     summary: Criar Checkout Session no Asaas para assinatura recorrente
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckoutRequest'
 *     responses:
 *       200:
 *         description: URL do Checkout Session criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CheckoutResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/checkout', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { planId } = req.body as { planId: string };

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      res.status(404).json({ error: 'Plano não encontrado' });
      return;
    }

    const baseUrl    = process.env.ADMIN_URL ?? '';
    const successUrl = `${baseUrl}/profile/plans?status=success`;
    const cancelUrl  = `${baseUrl}/profile/plans`;

    const data = await asaasRequest('POST', '/checkouts', {
      billingTypes: ['CREDIT_CARD'],
      chargeTypes:  ['RECURRENT'],
      externalReference: `kronuz:${userId}`,
      callback: { successUrl, cancelUrl },
      items: [
        {
          name:             plan.name,
          quantity:         1,
          value:            plan.price / 100,
          imageBase64:      '',
          externalReference: `kronuz:${userId}`,
        },
      ],
      subscription: {
        cycle:        'MONTHLY',
        nextDueDate:  new Date().toISOString().split('T')[0],
        externalReference: `kronuz:${userId}`,
      },
    }) as Record<string, unknown>;

    console.log('[billing/checkout] Asaas response:', JSON.stringify(data));

    const checkoutUrl = (data.link ?? data.url ?? data.paymentUrl ?? data.checkoutUrl) as string | undefined;
    if (!checkoutUrl) {
      throw new Error(`URL de checkout não encontrada na resposta: ${JSON.stringify(data)}`);
    }

    res.json({ url: checkoutUrl });
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
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
    const receivedToken =
      (req.headers['asaas-access-token'] as string | undefined) ??
      (req.query['token'] as string | undefined);

    if (webhookToken && receivedToken !== webhookToken) {
      // Always return 200 to avoid retry loops, but don't process
      return res.status(200).json({ received: true });
    }

    const { event, payment, subscription } = req.body as {
      event: string;
      payment?: { externalReference?: string; subscription?: string };
      subscription?: { id?: string; externalReference?: string };
    };

    // Extract externalReference and subscriptionId depending on event type
    let externalReference =
      payment?.externalReference ?? subscription?.externalReference;
    const subscriptionId =
      payment?.subscription ?? subscription?.id;

    // Se externalReference não veio no payment, busca na assinatura via API
    if (!externalReference && subscriptionId) {
      try {
        const sub = await asaasRequest('GET', `/subscriptions/${subscriptionId}`) as { externalReference?: string };
        externalReference = sub.externalReference;
      } catch (e) {
        console.warn(`[billing/webhook] Falha ao buscar assinatura ${subscriptionId}:`, e);
      }
    }

    if (event === 'PAYMENT_CONFIRMED') {
      if (!externalReference || !externalReference.startsWith('kronuz:')) {
        console.warn(`[billing/webhook] PAYMENT_CONFIRMED: invalid externalReference: ${externalReference}`);
        return res.status(200).json({ received: true });
      }

      const userId = externalReference.replace('kronuz:', '');

      await prisma.userPlan.updateMany({
        where: { userId },
        data: {
          subscriptionStatus: 'ACTIVE',
          ...(subscriptionId ? { subscriptionId } : {}),
        },
      });
    } else if (event === 'PAYMENT_OVERDUE' || event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_INACTIVATED') {
      if (!externalReference || !externalReference.startsWith('kronuz:')) {
        console.warn(`[billing/webhook] ${event}: invalid externalReference: ${externalReference}`);
        return res.status(200).json({ received: true });
      }

      const userId = externalReference.replace('kronuz:', '');

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
