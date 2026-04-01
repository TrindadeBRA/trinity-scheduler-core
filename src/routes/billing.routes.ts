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
      billingTypes:      ['CREDIT_CARD'],
      chargeTypes:       ['RECURRENT'],
      externalReference: `kronuz:${userId}`,
      callback:          { successUrl, cancelUrl },
      items: [
        {
          name:              plan.name,
          quantity:          1,
          value:             plan.price / 100,
          imageBase64:       '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',
          externalReference: planId,
        },
      ],
      subscription: {
        cycle:       'MONTHLY',
        nextDueDate: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
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
    const externalReference =
      payment?.externalReference ?? subscription?.externalReference;
    const subscriptionId =
      payment?.subscription ?? subscription?.id;

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
