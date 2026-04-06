import { PrismaClient } from '@prisma/client';

const DAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const FILL_RATE = 0.70;
const BATCH_SIZE = 500;

interface Schedule {
  start: string;
  end: string;
  lunchStart: string | null;
  lunchEnd: string | null;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function getAvailableSlots(schedule: Schedule): string[] {
  const startMin = timeToMin(schedule.start);
  const endMin = timeToMin(schedule.end);
  const lunchStartMin = schedule.lunchStart ? timeToMin(schedule.lunchStart) : -1;
  const lunchEndMin = schedule.lunchEnd ? timeToMin(schedule.lunchEnd) : -1;

  const slots: string[] = [];
  for (let min = startMin; min < endMin; min += 30) {
    if (lunchStartMin >= 0 && min >= lunchStartMin && min < lunchEndMin) continue;
    slots.push(minToTime(min));
  }
  return slots;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const CANCEL_REASONS = [
  'Cliente desistiu', 'Imprevisto pessoal', 'Mudança de horário',
  'Problema de transporte', 'Motivos de saúde', 'Não compareceu',
];

/**
 * Gera agendamentos para todos os profissionais com ~70% de ocupação.
 * Cobre os últimos 3 meses + 7 dias futuros.
 */
export async function seedAppointments(prisma: PrismaClient, shopId: string, fallbackUnitId: string) {
  // Limpa agendamentos existentes para recriar
  const existingCount = await prisma.appointment.count({ where: { shopId } });
  if (existingCount > 0) {
    await prisma.appointmentAddon.deleteMany({ where: { appointment: { shopId } } });
    await prisma.appointment.deleteMany({ where: { shopId } });
    console.log(`Seed: ${existingCount} agendamentos antigos removidos.`);
  }

  // Busca dados necessários
  const professionals = await prisma.professional.findMany({
    where: { shopId, active: true },
    select: { id: true, unitId: true },
  });

  const workingHours = await prisma.workingHour.findMany({
    where: { professionalId: { in: professionals.map(p => p.id) } },
    select: { professionalId: true, day: true, start: true, end: true, lunchStart: true, lunchEnd: true },
  });

  const clientIds = (await prisma.client.findMany({ where: { shopId }, select: { id: true } })).map(c => c.id);
  const services = await prisma.service.findMany({ where: { shopId, type: 'service' }, select: { id: true, duration: true, price: true } });
  const addonServices = await prisma.service.findMany({ where: { shopId, type: 'addon' }, select: { id: true, name: true, duration: true, price: true } });

  if (clientIds.length === 0 || services.length === 0) {
    console.log('Seed: sem clientes ou serviços, pulando agendamentos.');
    return;
  }

  // Monta mapa: profId → day → schedule
  const scheduleMap = new Map<string, Map<string, Schedule>>();
  for (const wh of workingHours) {
    if (!wh.start || !wh.end) continue;
    if (!scheduleMap.has(wh.professionalId)) scheduleMap.set(wh.professionalId, new Map());
    scheduleMap.get(wh.professionalId)!.set(wh.day, {
      start: wh.start, end: wh.end,
      lunchStart: wh.lunchStart, lunchEnd: wh.lunchEnd,
    });
  }

  const profUnitMap = new Map(professionals.map(p => [p.id, p.unitId ?? fallbackUnitId]));

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const currentTime = today.toTimeString().slice(0, 5);

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3);
  startDate.setDate(1);

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);

  // Gera agendamentos
  const appointments: Array<{
    shopId: string; clientId: string; serviceId: string; professionalId: string;
    unitId: string; date: string; time: string; duration: number; price: number;
    status: string; cancelReason: string | null; notes: string;
  }> = [];

  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const dayName = DAYS_PT[cursor.getDay()];
    const isFuture = dateStr > todayStr;
    const isToday = dateStr === todayStr;

    for (const prof of professionals) {
      const daySchedule = scheduleMap.get(prof.id)?.get(dayName);
      if (!daySchedule) continue;

      const availableSlots = getAvailableSlots(daySchedule);
      if (availableSlots.length === 0) continue;

      const slotsToFill = Math.round(availableSlots.length * FILL_RATE);
      const shuffled = [...availableSlots].sort(() => Math.random() - 0.5);
      const pickedSlots = shuffled.slice(0, slotsToFill);

      for (const slot of pickedSlots) {
        const svc = pickRandom(services);
        const clientId = pickRandom(clientIds);
        const profUnit = profUnitMap.get(prof.id) ?? fallbackUnitId;

        let status: string;
        let cancelReason: string | null = null;

        if (isFuture || (isToday && slot >= currentTime)) {
          status = 'confirmed';
        } else {
          const rand = Math.random();
          if (rand < 0.13) {
            status = 'cancelled';
            cancelReason = pickRandom(CANCEL_REASONS);
          } else {
            status = 'completed';
          }
        }

        appointments.push({
          shopId, clientId, serviceId: svc.id, professionalId: prof.id,
          unitId: profUnit, date: dateStr, time: slot,
          duration: svc.duration, price: svc.price,
          status, cancelReason, notes: '',
        });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  // Insere em batches
  for (let i = 0; i < appointments.length; i += BATCH_SIZE) {
    await prisma.appointment.createMany({ data: appointments.slice(i, i + BATCH_SIZE) });
  }

  // Adicionais aleatórios em ~30% dos agendamentos
  if (addonServices.length > 0) {
    const createdAppts = await prisma.appointment.findMany({ where: { shopId }, select: { id: true } });
    const addonRecords: Array<{ appointmentId: string; serviceId: string; name: string; duration: number; price: number }> = [];

    for (const appt of createdAppts) {
      const rand = Math.random();
      if (rand < 0.15) {
        const shuffled = [...addonServices].sort(() => Math.random() - 0.5);
        for (const addon of shuffled.slice(0, Math.min(2, shuffled.length))) {
          addonRecords.push({ appointmentId: appt.id, serviceId: addon.id, name: addon.name, duration: addon.duration, price: addon.price });
        }
      } else if (rand < 0.35) {
        const addon = pickRandom(addonServices);
        addonRecords.push({ appointmentId: appt.id, serviceId: addon.id, name: addon.name, duration: addon.duration, price: addon.price });
      }
    }

    if (addonRecords.length > 0) {
      for (let i = 0; i < addonRecords.length; i += BATCH_SIZE) {
        await prisma.appointmentAddon.createMany({ data: addonRecords.slice(i, i + BATCH_SIZE) });
      }
      console.log(`Seed: ${addonRecords.length} adicionais vinculados.`);
    }
  }

  // Atualiza totalSpent e lastVisit dos clientes
  const completedAppts = await prisma.appointment.findMany({
    where: { shopId, status: 'completed' },
    include: { addons: true },
  });

  const clientTotals = new Map<string, { spent: number; lastDate: string }>();
  for (const appt of completedAppts) {
    const addonTotal = appt.addons.reduce((sum, a) => sum + a.price, 0);
    const total = appt.price + addonTotal;
    const prev = clientTotals.get(appt.clientId);
    if (!prev) {
      clientTotals.set(appt.clientId, { spent: total, lastDate: appt.date });
    } else {
      prev.spent += total;
      if (appt.date > prev.lastDate) prev.lastDate = appt.date;
    }
  }

  for (const [clientId, { spent, lastDate }] of clientTotals) {
    await prisma.client.update({
      where: { id: clientId },
      data: { totalSpent: spent, lastVisit: new Date(lastDate + 'T12:00:00Z') },
    });
  }

  const confirmed = appointments.filter(a => a.status === 'confirmed').length;
  const completed = appointments.filter(a => a.status === 'completed').length;
  const cancelled = appointments.filter(a => a.status === 'cancelled').length;
  console.log(`Seed: ${appointments.length} agendamentos (${confirmed} confirmados, ${completed} concluídos, ${cancelled} cancelados).`);
  console.log(`Seed: totalSpent atualizado para ${clientTotals.size} clientes.`);
}
