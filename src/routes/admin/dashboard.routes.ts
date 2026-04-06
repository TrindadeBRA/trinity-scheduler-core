import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { AppError } from '../../utils/errors';
import { applyProfessionalFilter } from '../../utils/dataFilter';

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
 *       - in: query
 *         name: unitId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por unidade (opcional)
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
router.get('/dashboard/stats', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    const { date, unitId } = req.query;

    if (!date) throw new AppError(400, 'VALIDATION_ERROR', 'Query param date é obrigatório');

    const where: Record<string, unknown> = { date };
    if (shopId) where.shopId = shopId;
    if (unitId) where.unitId = unitId;

    // Apply professional filter
    const filteredWhere = applyProfessionalFilter(where, {
      role: req.user?.role || 'leader',
      professionalId: req.user?.professionalId
    });

    const appointments = await prisma.appointment.findMany({
      where: filteredWhere,
      include: { service: { select: { name: true } } },
    });

    // Revenue: soma dos preços de confirmed/completed (em centavos)
    const revenue = appointments
      .filter((a) => a.status === 'confirmed' || a.status === 'completed')
      .reduce((sum, a) => sum + a.price, 0);

    const appointmentCount = appointments.length;

    // Top service: serviço com mais agendamentos nos últimos 7 dias
    // Usa groupBy para ser leve — uma única query com COUNT
    const sevenDaysAgo = new Date(date as string + 'T00:00:00.000Z');
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

    const topServiceWhere: Record<string, unknown> = {
      date: { gte: sevenDaysAgoStr, lte: date as string },
      status: { in: ['confirmed', 'completed'] },
    };
    if (shopId) topServiceWhere.shopId = shopId;
    if (unitId) topServiceWhere.unitId = unitId;

    const topServiceFilteredWhere = applyProfessionalFilter(topServiceWhere, {
      role: req.user?.role || 'leader',
      professionalId: req.user?.professionalId
    });

    const topServiceGroup = await prisma.appointment.groupBy({
      by: ['serviceId'],
      where: topServiceFilteredWhere,
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 1,
    });

    let topService: string | null = null;
    let topServiceCount = 0;
    let topServiceRevenue = 0;
    if (topServiceGroup.length > 0) {
      topServiceCount = topServiceGroup[0]._count.serviceId;
      const svc = await prisma.service.findUnique({
        where: { id: topServiceGroup[0].serviceId },
        select: { name: true },
      });
      topService = svc?.name ?? null;

      const revenueAgg = await prisma.appointment.aggregate({
        where: { ...topServiceFilteredWhere, serviceId: topServiceGroup[0].serviceId },
        _sum: { price: true },
      });
      topServiceRevenue = revenueAgg._sum.price ?? 0;
    }

    // New clients: clientes criados na data
    const dateStart = new Date(date as string + 'T00:00:00.000Z');
    const dateEnd = new Date(date as string + 'T23:59:59.999Z');

    // For professionals, count only clients who made their first appointment with this professional
    let newClients = 0;
    if (req.user?.role === 'professional' && req.user?.professionalId) {
      // Get unique client IDs from appointments on this date for this professional
      const clientIds = appointments.map(a => a.clientId);
      const uniqueClientIds = [...new Set(clientIds)];
      
      // Count how many of these clients had their first appointment with this professional on this date
      for (const clientId of uniqueClientIds) {
        const firstAppointment = await prisma.appointment.findFirst({
          where: { clientId, professionalId: req.user.professionalId },
          orderBy: { createdAt: 'asc' }
        });
        if (firstAppointment && firstAppointment.date === date) {
          newClients++;
        }
      }
    } else {
      // For admin/leader, count all new clients in the shop
      const newClientsWhere: Record<string, unknown> = {
        createdAt: { gte: dateStart, lte: dateEnd },
      };
      if (shopId) newClientsWhere.shopId = shopId;
      newClients = await prisma.client.count({ where: newClientsWhere });
    }

    res.json({ revenue, appointmentCount, topService, topServiceCount, topServiceRevenue, newClients });
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
 *     parameters:
 *       - in: query
 *         name: unitId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por unidade (opcional)
 *     responses:
 *       200:
 *         description: Faturamento semanal por dia
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WeeklyRevenue'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/dashboard/weekly-revenue', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    const { unitId } = req.query;

    // Semana atual: Segunda a Domingo
    const now = new Date();
    const jsDay = now.getDay(); // 0=Dom, 1=Seg, ...
    const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);

    const days: string[] = [];
    const dayLabels: Record<string, string> = {};
    const weekdayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push(iso);
      dayLabels[iso] = weekdayNames[i];
    }

    const where: Record<string, unknown> = {
      date: { in: days },
      status: { in: ['confirmed', 'completed'] },
    };
    if (shopId) where.shopId = shopId;
    if (unitId) where.unitId = unitId;

    // Apply professional filter
    const filteredWhere = applyProfessionalFilter(where, {
      role: req.user?.role || 'leader',
      professionalId: req.user?.professionalId
    });

    const appointments = await prisma.appointment.findMany({
      where: filteredWhere,
      include: { professional: { select: { name: true } } },
    });

    // Collect unique professional names
    const profNames = new Set<string>();
    for (const a of appointments) {
      profNames.add(a.professional.name);
    }

    // Build revenue map: day -> profName -> total
    const revenueMap: Record<string, Record<string, number>> = {};
    for (const day of days) {
      revenueMap[day] = {};
      for (const name of profNames) {
        revenueMap[day][name] = 0;
      }
    }
    for (const a of appointments) {
      revenueMap[a.date][a.professional.name] += a.price;
    }

    const result = days.map((date) => {
      const entry: Record<string, string | number> = { day: dayLabels[date] };
      for (const name of profNames) {
        entry[name] = revenueMap[date][name];
      }
      return entry;
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/dashboard/weekly-cancelled:
 *   get:
 *     tags: [Admin Dashboard]
 *     summary: Valor cancelado dos últimos 7 dias
 *     description: Retorna o valor de agendamentos cancelados agrupado por dia da semana atual. Valores em centavos. Mesmo formato do weekly-revenue.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unitId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por unidade (opcional)
 *     responses:
 *       200:
 *         description: Cancelamentos semanais por dia
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WeeklyRevenue'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/dashboard/weekly-cancelled', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    const { unitId } = req.query;

    const now = new Date();
    const jsDay = now.getDay();
    const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);

    const days: string[] = [];
    const dayLabels: Record<string, string> = {};
    const weekdayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push(iso);
      dayLabels[iso] = weekdayNames[i];
    }

    const where: Record<string, unknown> = {
      date: { in: days },
      status: 'cancelled',
    };
    if (shopId) where.shopId = shopId;
    if (unitId) where.unitId = unitId;

    // Apply professional filter
    const filteredWhere = applyProfessionalFilter(where, {
      role: req.user?.role || 'leader',
      professionalId: req.user?.professionalId
    });

    const appointments = await prisma.appointment.findMany({
      where: filteredWhere,
      include: { professional: { select: { name: true } } },
    });

    // Soma total por dia (sem separar por profissional)
    const cancelledMap: Record<string, number> = {};
    for (const day of days) {
      cancelledMap[day] = 0;
    }
    for (const a of appointments) {
      cancelledMap[a.date] += a.price;
    }

    const result = days.map((date) => ({
      day: dayLabels[date],
      Cancelados: cancelledMap[date],
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
