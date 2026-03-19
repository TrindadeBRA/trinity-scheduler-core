import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { getAvailableSlots } from './availability.service';

export async function createAppointment(data: {
  shopId: string;
  clientId: string;
  serviceId: string;
  professionalId: string | null;
  addonIds?: string[];
  date: string;
  time: string;
  notes?: string;
}) {
  const { shopId, clientId, serviceId, professionalId, addonIds = [], date, time, notes } = data;

  // Busca o serviço principal
  const service = await prisma.service.findFirst({
    where: { id: serviceId, shopId },
  });
  if (!service) throw new AppError(404, 'NOT_FOUND', 'Serviço não encontrado');

  // Busca adicionais
  const addons = addonIds.length > 0
    ? await prisma.service.findMany({ where: { id: { in: addonIds }, shopId, type: 'addon' } })
    : [];

  // Calcula duração e preço totais (em centavos)
  const totalDuration = service.duration + addons.reduce((sum, a) => sum + a.duration, 0);
  const totalPrice = service.price + addons.reduce((sum, a) => sum + a.price, 0);

  // Determina o profissional
  let resolvedProfessionalId = professionalId;

  if (!resolvedProfessionalId) {
    // Auto-atribuição: encontra profissional disponível
    const slots = await getAvailableSlots(shopId, null, date, totalDuration);
    const slotAvailable = slots.find((s) => s.time === time && s.available);
    if (!slotAvailable) throw new AppError(409, 'CONFLICT', 'Horário não disponível');

    // Encontra o primeiro profissional disponível nesse slot
    const professionals = await prisma.professional.findMany({
      where: { shopId, active: true },
      select: { id: true },
    });

    for (const prof of professionals) {
      const profSlots = await getAvailableSlots(shopId, prof.id, date, totalDuration);
      const available = profSlots.find((s) => s.time === time && s.available);
      if (available) {
        resolvedProfessionalId = prof.id;
        break;
      }
    }

    if (!resolvedProfessionalId) {
      throw new AppError(409, 'CONFLICT', 'Nenhum profissional disponível neste horário');
    }
  } else {
    // Valida disponibilidade do profissional específico
    const slots = await getAvailableSlots(shopId, resolvedProfessionalId, date, totalDuration);
    const slotAvailable = slots.find((s) => s.time === time && s.available);
    if (!slotAvailable) throw new AppError(409, 'CONFLICT', 'Horário não disponível para este profissional');
  }

  const appointment = await prisma.appointment.create({
    data: {
      shopId,
      clientId,
      serviceId,
      professionalId: resolvedProfessionalId,
      date,
      time,
      duration: totalDuration,
      price: totalPrice,
      status: 'confirmed',
      notes: notes || null,
    },
    include: {
      service: { select: { name: true } },
      professional: { select: { name: true } },
      client: { select: { name: true, phone: true } },
    },
  });

  return {
    ...appointment,
    serviceName: appointment.service.name,
    professionalName: appointment.professional.name,
  };
}

export async function cancelAppointment(appointmentId: string, reason: string): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) throw new AppError(404, 'NOT_FOUND', 'Agendamento não encontrado');
  if (appointment.status === 'cancelled') {
    throw new AppError(409, 'CONFLICT', 'Agendamento já está cancelado');
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'cancelled', cancelReason: reason },
  });
}
