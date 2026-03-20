import { prisma } from '../utils/prisma';

export interface Slot {
  time: string;
  available: boolean;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function getDayName(date: string): string {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const d = new Date(date + 'T12:00:00');
  return days[d.getDay()];
}

function generateSlots(start: string, end: string, interval = 30): string[] {
  const slots: string[] = [];
  let current = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  while (current < endMin) {
    slots.push(minutesToTime(current));
    current += interval;
  }
  return slots;
}

function slotConflicts(
  slotTime: string,
  serviceDuration: number,
  appointments: Array<{ time: string; duration: number }>
): boolean {
  const slotStart = timeToMinutes(slotTime);
  const slotEnd = slotStart + serviceDuration;

  return appointments.some((appt) => {
    const apptStart = timeToMinutes(appt.time);
    const apptEnd = apptStart + appt.duration;
    return slotStart < apptEnd && slotEnd > apptStart;
  });
}

async function getSlotsForProfessional(
  shopId: string,
  professionalId: string,
  date: string,
  shopHour: { start: string; end: string },
  serviceDuration: number
): Promise<string[]> {
  const dayName = getDayName(date);

  const workingHour = await prisma.workingHour.findUnique({
    where: { professionalId_day: { professionalId, day: dayName } },
  });

  if (!workingHour || !workingHour.start || !workingHour.end) {
    return [];
  }

  const effectiveStartMin = Math.max(timeToMinutes(workingHour.start), timeToMinutes(shopHour.start));
  const effectiveEndMin = Math.min(timeToMinutes(workingHour.end), timeToMinutes(shopHour.end));

  if (effectiveStartMin >= effectiveEndMin) {
    return [];
  }

  // Gera slots alinhados com o horário da loja para garantir correspondência
  let slots = generateSlots(shopHour.start, shopHour.end);

  // Filtra apenas slots dentro do horário efetivo do profissional
  slots = slots.filter((s) => {
    const t = timeToMinutes(s);
    return t >= effectiveStartMin && t + serviceDuration <= effectiveEndMin;
  });

  // Remove horário de almoço
  if (workingHour.lunchStart && workingHour.lunchEnd) {
    const lunchStart = timeToMinutes(workingHour.lunchStart);
    const lunchEnd = timeToMinutes(workingHour.lunchEnd);
    slots = slots.filter((s) => {
      const t = timeToMinutes(s);
      const slotEnd = t + serviceDuration;
      // Remove se o slot começa durante o almoço OU se o serviço invade o almoço
      return !(t < lunchEnd && slotEnd > lunchStart);
    });
  }

  // Busca agendamentos existentes
  const appointments = await prisma.appointment.findMany({
    where: {
      shopId,
      professionalId,
      date,
      status: { in: ['confirmed', 'completed'] },
    },
    select: { time: true, duration: true },
  });

  // Remove slots com conflito
  slots = slots.filter((s) => !slotConflicts(s, serviceDuration, appointments));

  return slots;
}

export async function getAvailableSlots(
  shopId: string,
  professionalId: string | null,
  date: string,
  serviceDuration = 30
): Promise<Slot[]> {
  const dayName = getDayName(date);

  const shopHour = await prisma.shopHour.findUnique({
    where: { shopId_day: { shopId, day: dayName } },
  });

  if (!shopHour || !shopHour.start || !shopHour.end) {
    return [];
  }

  const shopEndMin = timeToMinutes(shopHour.end);
  const allSlots = generateSlots(shopHour.start, shopHour.end)
    .filter((time) => timeToMinutes(time) + serviceDuration <= shopEndMin);

  // Se a data é hoje, remove slots cujo horário já passou
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = date === todayStr;
  let filteredSlots = allSlots;
  if (isToday) {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    filteredSlots = allSlots.filter((time) => timeToMinutes(time) > nowMinutes);
  }

  if (professionalId) {
    const availableSlots = await getSlotsForProfessional(
      shopId, professionalId, date,
      { start: shopHour.start, end: shopHour.end },
      serviceDuration
    );
    const availableSet = new Set(availableSlots);
    return filteredSlots.map((time) => ({ time, available: availableSet.has(time) }));
  }

  // Sem professionalId: unir disponibilidade de todos os profissionais
  const professionals = await prisma.professional.findMany({
    where: { shopId, active: true },
    select: { id: true },
  });

  const availableByProfessional = await Promise.all(
    professionals.map((p) =>
      getSlotsForProfessional(shopId, p.id, date, { start: shopHour.start!, end: shopHour.end! }, serviceDuration)
    )
  );

  const unionAvailable = new Set(availableByProfessional.flat());
  return filteredSlots.map((time) => ({ time, available: unionAvailable.has(time) }));
}

export async function getDisabledDates(
  shopId: string,
  professionalId: string | null,
  startDate: string,
  endDate: string
): Promise<string[]> {
  const disabled: string[] = [];
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');

  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const slots = await getAvailableSlots(shopId, professionalId, dateStr);
    const hasAvailable = slots.some((s) => s.available);
    if (!hasAvailable) {
      disabled.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }

  return disabled;
}
