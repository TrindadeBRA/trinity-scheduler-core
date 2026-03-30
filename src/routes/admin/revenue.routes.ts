import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { applyProfessionalFilter } from '../../utils/dataFilter';

const router = Router();

/**
 * @swagger
 * /admin/revenue/summary:
 *   get:
 *     tags: [Admin Revenue]
 *     summary: Resumo de faturamento com filtros
 *     description: >
 *       Retorna agregações de faturamento para o período e filtros especificados.
 *       Todos os valores monetários (totalRevenue, averageTicket, lostRevenue e os
 *       campos `total` dos arrays) são retornados em **centavos** (inteiro),
 *       conforme convenção do projeto.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unitId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por unidade (opcional)
 *       - in: query
 *         name: staffId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por profissional (opcional)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           example: '2024-01-01'
 *         description: Data de início do período (yyyy-MM-dd, inclusivo)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           example: '2024-12-31'
 *         description: Data de fim do período (yyyy-MM-dd, inclusivo)
 *     responses:
 *       200:
 *         description: Resumo de faturamento
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RevenueSummary'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/revenue/summary', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    const { unitId, staffId, startDate, endDate } = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = {};
    if (shopId) where.shopId = shopId;
    
    // Apply professional filter when role is 'professional'
    const filteredWhere = applyProfessionalFilter(where, {
      role: req.user?.role || 'leader',
      shopId,
      professionalId: req.user?.professionalId
    });
    
    // Apply other filters
    if (unitId) filteredWhere.unitId = unitId;
    
    // staffId filter overrides professional filter if provided
    if (staffId) filteredWhere.professionalId = staffId;
    
    if (startDate || endDate) {
      filteredWhere.date = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    const appointments = await prisma.appointment.findMany({
      where: filteredWhere,
      include: {
        service: { select: { name: true } },
        professional: { select: { id: true, name: true } },
      },
    });

    const completed = appointments.filter((a) => a.status === 'completed');
    const cancelled = appointments.filter((a) => a.status === 'cancelled');

    const totalRevenue = completed.reduce((sum, a) => sum + a.price, 0);
    const completedCount = completed.length;
    const averageTicket = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;
    const lostRevenue = cancelled.reduce((sum, a) => sum + a.price, 0);

    // dailyRevenue — groupBy date, sort ASC
    const dailyMap: Record<string, number> = {};
    for (const a of completed) {
      dailyMap[a.date] = (dailyMap[a.date] || 0) + a.price;
    }
    const dailyRevenue = Object.keys(dailyMap)
      .sort()
      .map((date) => {
        const [year, month, day] = date.split('-');
        return { date, label: `${day}/${month}`, total: dailyMap[date] };
      });

    // serviceBreakdown — groupBy service name, sort DESC
    const serviceMap: Record<string, number> = {};
    for (const a of completed) {
      const name = a.service.name;
      serviceMap[name] = (serviceMap[name] || 0) + a.price;
    }
    const serviceBreakdown = Object.keys(serviceMap)
      .map((serviceName) => ({
        serviceName,
        total: serviceMap[serviceName],
        percentage: totalRevenue > 0 ? (serviceMap[serviceName] / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // staffRanking — groupBy professionalId, sort DESC, top 5
    // For professionals, only include their own record
    const staffMap: Record<string, { staffName: string; total: number }> = {};
    for (const a of completed) {
      const pid = a.professional.id;
      if (!staffMap[pid]) staffMap[pid] = { staffName: a.professional.name, total: 0 };
      staffMap[pid].total += a.price;
    }
    let staffRanking = Object.keys(staffMap)
      .map((staffId) => ({ staffId, staffName: staffMap[staffId].staffName, total: staffMap[staffId].total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    
    // If role is professional, filter staffRanking to only include the professional
    if (req.user?.role === 'professional' && req.user?.professionalId) {
      staffRanking = staffRanking.filter(s => s.staffId === req.user?.professionalId);
    }

    res.json({ totalRevenue, averageTicket, completedCount, lostRevenue, dailyRevenue, serviceBreakdown, staffRanking });
  } catch (err) {
    next(err);
  }
});

export default router;
