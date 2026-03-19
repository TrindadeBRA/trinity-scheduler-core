import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /admin/dashboard/stats:
 *   get:
 *     tags: [Admin Dashboard]
 *     summary: Obter estatísticas do dia
 *     description: Retorna métricas do estabelecimento para uma data específica. Revenue em centavos.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           example: '2024-12-25'
 *         description: Data no formato YYYY-MM-DD
 *     responses:
 *       200:
 *         description: Estatísticas do dia
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardStats'
 *       400:
 *         description: Parâmetro date ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/dashboard/stats', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    const { date } = req.query;

    if (!date) throw new AppError(400, 'VALIDATION_ERROR', 'Query param date é obrigatório');

    const where: Record<string, unknown> = { date };
    if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

    const appointments = await prisma.appointment.findMany({
      where,
      include: { service: { select: { name: true } } },
    });

    // Revenue: soma dos preços de confirmed/completed (em centavos)
    const revenue = appointments
      .filter((a) => a.status === 'confirmed' || a.status === 'completed')
      .reduce((sum, a) => sum + a.price, 0);

    const appointmentCount = appointments.length;

    // Top service: serviço com mais agendamentos
    const serviceCount: Record<string, { name: string; count: number }> = {};
    for (const a of appointments) {
      if (!serviceCount[a.serviceId]) {
        serviceCount[a.serviceId] = { name: a.service.name, count: 0 };
      }
      serviceCount[a.serviceId].count++;
    }
    const topServiceEntry = Object.values(serviceCount).sort((a, b) => b.count - a.count)[0];
    const topService = topServiceEntry?.name || null;

    // New clients: clientes criados na data
    const dateStart = new Date(date as string + 'T00:00:00.000Z');
    const dateEnd = new Date(date as string + 'T23:59:59.999Z');

    const newClientsWhere: Record<string, unknown> = {
      createdAt: { gte: dateStart, lte: dateEnd },
    };
    if (shopId && req.user?.role !== 'admin') newClientsWhere.shopId = shopId;

    const newClients = await prisma.client.count({ where: newClientsWhere });

    res.json({ revenue, appointmentCount, topService, newClients });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/dashboard/weekly-revenue:
 *   get:
 *     tags: [Admin Dashboard]
 *     summary: Faturamento dos últimos 7 dias
 *     description: Retorna o faturamento agrupado por dia dos últimos 7 dias. Valores em centavos.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Faturamento semanal por dia
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date:
 *                     type: string
 *                     example: '2024-12-25'
 *                   revenue:
 *                     type: integer
 *                     description: Faturamento em centavos
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/dashboard/weekly-revenue', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;

    // Últimos 7 dias
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }

    const where: Record<string, unknown> = {
      date: { in: days },
      status: { in: ['confirmed', 'completed'] },
    };
    if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

    const appointments = await prisma.appointment.findMany({
      where,
      select: { date: true, price: true },
    });

    const revenueByDay: Record<string, number> = {};
    for (const day of days) {
      revenueByDay[day] = 0;
    }
    for (const a of appointments) {
      revenueByDay[a.date] = (revenueByDay[a.date] || 0) + a.price;
    }

    const result = days.map((date) => ({ date, revenue: revenueByDay[date] }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
