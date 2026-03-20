import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { createAppointment, cancelAppointment } from '../../services/appointment.service';
import { AppError } from '../../utils/errors';

const router = Router();

/**
 * @swagger
 * /appointments:
 *   post:
 *     tags: [Client Appointments]
 *     summary: Criar agendamento
 *     description: Cria um novo agendamento. Se professionalId for null, o sistema auto-atribui um profissional disponível.
 *     parameters:
 *       - in: header
 *         name: X-Shop-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppointmentInput'
 *     responses:
 *       201:
 *         description: Agendamento criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: Campos obrigatórios ausentes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Horário não disponível
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não resolvido');

    const { clientId, serviceId, professionalId, addonIds, date, time, notes } = req.body;

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
    });

    res.status(201).json(appointment);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /appointments:
 *   get:
 *     tags: [Client Appointments]
 *     summary: Listar agendamentos do cliente
 *     parameters:
 *       - in: header
 *         name: X-Shop-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lista de agendamentos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Appointment'
 *       400:
 *         description: clientId ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = req.shopId;
    if (!shopId) throw new AppError(400, 'VALIDATION_ERROR', 'shopId não resolvido');

    const { clientId } = req.query;
    if (!clientId) throw new AppError(400, 'VALIDATION_ERROR', 'Query param clientId é obrigatório');

    const appointments = await prisma.appointment.findMany({
      where: { shopId, clientId: clientId as string },
      include: {
        service: { select: { name: true } },
        professional: { select: { name: true } },
        addons: true,
      },
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    });

    const result = appointments.map((a) => ({
      ...a,
      serviceName: a.service.name,
      professionalName: a.professional.name,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /appointments/{id}/cancel:
 *   patch:
 *     tags: [Client Appointments]
 *     summary: Cancelar agendamento
 *     parameters:
 *       - in: header
 *         name: X-Shop-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       204:
 *         description: Agendamento cancelado com sucesso
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Agendamento já cancelado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await cancelAppointment(id, reason || '');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
