import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { authorize } from '../../middlewares/authorize';
import { createAppointment, cancelAppointment } from '../../services/appointment.service';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /admin/appointments:
 *   get:
 *     tags: [Admin Appointments]
 *     summary: Listar agendamentos
 *     description: Lista agendamentos com filtros. Professional vê apenas os próprios.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           example: '2024-12-25'
 *       - in: query
 *         name: professionalId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [confirmed, cancelled, completed, noshow]
 *       - in: query
 *         name: serviceId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [date, time, clientName, serviceName, professionalName, status, price, duration]
 *           default: date
 *         description: Campo para ordenação
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Direção da ordenação
 *       - in: query
 *         name: unitId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por unidade (opcional)
 *     responses:
 *       200:
 *         description: Lista de agendamentos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appointment'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/appointments', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    const { date, professionalId, status, serviceId, clientId, search, startDate, endDate, sortBy = 'date', sortOrder = 'desc', unitId } = req.query;

    // Professional só vê os próprios agendamentos
    const effectiveProfessionalId = req.user?.role === 'professional'
      ? req.user.professionalId
      : (professionalId as string | undefined);

    const where: Record<string, unknown> = {};
    if (shopId && req.user?.role !== 'admin') where.shopId = shopId;
    if (date) where.date = date;
    if (effectiveProfessionalId) where.professionalId = effectiveProfessionalId;
    if (status && status !== 'all') where.status = status;
    if (serviceId && serviceId !== 'all') where.serviceId = serviceId;
    if (clientId && clientId !== 'all') where.clientId = clientId;
    if (unitId) where.unitId = unitId;

    // Filtro por intervalo de datas
    if (startDate || endDate) {
      const dateFilter: Record<string, string> = {};
      if (startDate) dateFilter.gte = startDate as string;
      if (endDate) dateFilter.lte = endDate as string;
      where.date = dateFilter;
    }

    // Busca textual por nome de cliente, serviço ou profissional
    if (search) {
      where.OR = [
        { client: { name: { contains: search as string, mode: 'insensitive' } } },
        { service: { name: { contains: search as string, mode: 'insensitive' } } },
        { professional: { name: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const direction = sortOrder === 'asc' ? 'asc' as const : 'desc' as const;
    const relationSortMap: Record<string, object[]> = {
      clientName: [{ client: { name: direction } }],
      serviceName: [{ service: { name: direction } }],
      professionalName: [{ professional: { name: direction } }],
    };
    const directFields = ['date', 'time', 'status', 'price', 'duration'];
    let orderBy: object[];
    if (relationSortMap[sortBy as string]) {
      orderBy = relationSortMap[sortBy as string];
    } else if (directFields.includes(sortBy as string)) {
      orderBy = [{ [sortBy as string]: direction }];
    } else {
      orderBy = [{ date: 'desc' }, { time: 'desc' }];
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        service: { select: { name: true } },
        professional: { select: { name: true } },
        client: { select: { name: true, phone: true } },
        addons: true,
      },
      orderBy,
    });

    const result = appointments.map((a) => ({
      ...a,
      serviceName: a.service.name,
      professionalName: a.professional.name,
      clientName: a.client.name ?? a.client.phone,
      clientPhone: a.client.phone,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/appointments/{id}:
 *   get:
 *     tags: [Admin Appointments]
 *     summary: Obter agendamento por ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Agendamento encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/appointments/:id', authorize('leader', 'professional', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id };
    if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

    const appointment = await prisma.appointment.findFirst({
      where,
      include: {
        service: { select: { name: true } },
        professional: { select: { name: true } },
        client: { select: { name: true, phone: true } },
        addons: true,
      },
    });

    if (!appointment) throw new AppError(404, 'NOT_FOUND', 'Agendamento não encontrado');

    res.json({ ...appointment, serviceName: appointment.service.name, professionalName: appointment.professional.name });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/appointments:
 *   post:
 *     tags: [Admin Appointments]
 *     summary: Criar agendamento (admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppointmentInput'
 *     responses:
 *       201:
 *         description: Agendamento criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: Horário não disponível
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/appointments', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId || req.user?.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não encontrado');

    const { clientId, serviceId, professionalId, addonIds, date, time, notes, unitId } = req.body;

    if (!clientId || !serviceId || !date || !time) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Campos clientId, serviceId, date e time são obrigatórios');
    }

    const appointment = await createAppointment({
      shopId,
      clientId,
      serviceId,
      professionalId: professionalId || null,
      addonIds: addonIds || [],
      date,
      time,
      notes,
      unitId: unitId || null,
    });

    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/appointments/{id}:
 *   put:
 *     tags: [Admin Appointments]
 *     summary: Atualizar agendamento
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppointmentUpdateInput'
 *     responses:
 *       200:
 *         description: Agendamento atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/appointments/:id', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const shopId = req.shopId || req.user?.shopId;
    const { status, notes, cancelReason, date, time, professionalId } = req.body;

    const where: Record<string, unknown> = { id };
    if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

    const existing = await prisma.appointment.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Agendamento não encontrado');

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        ...(cancelReason !== undefined && { cancelReason }),
        ...(date !== undefined && { date }),
        ...(time !== undefined && { time }),
        ...(professionalId !== undefined && { professionalId }),
      },
      include: {
        service: { select: { name: true } },
        professional: { select: { name: true } },
        client: { select: { name: true, phone: true } },
        addons: true,
      },
    });

    res.json({
      ...updated,
      serviceName: updated.service.name,
      professionalName: updated.professional.name,
      clientName: updated.client.name ?? updated.client.phone,
      clientPhone: updated.client.phone,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /admin/appointments/{id}:
 *   delete:
 *     tags: [Admin Appointments]
 *     summary: Excluir agendamento
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Agendamento excluído
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/appointments/:id', authorize('leader', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const shopId = req.shopId || req.user?.shopId;

    const where: Record<string, unknown> = { id };
    if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

    const existing = await prisma.appointment.findFirst({ where });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Agendamento não encontrado');

    await prisma.appointment.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
