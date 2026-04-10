import { prisma } from '../utils/prisma';
import { SHOP_TIMEZONE } from '../config/constants';

export interface Slot {
  time: string;
  available: boolean;
}

function getNowInTimezone(tz: string): { dateStr: string; minutes: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const minutes = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);
  return { dateStr, minutes };
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
  while (current <= endMin) {
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
    return t >= effectiveStartMin && t <= effectiveEndMin;
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

  // Remove slots com conflito de agendamentos
  slots = slots.filter((s) => !slotConflicts(s, serviceDuration, appointments));

  // Busca bloqueios de horário
  const timeBlocks = await prisma.timeBlock.findMany({
    where: { shopId, professionalId, date },
    select: { startTime: true, duration: true },
  });

  // Remove slots que colidem com algum bloqueio
  if (timeBlocks.length > 0) {
    slots = slots.filter(
      (s) => !slotConflicts(s, serviceDuration, timeBlocks.map((tb) => ({ time: tb.startTime, duration: tb.duration })))
    );
  }

  return slots;
}

export async function getAvailableSlots(
  shopId: string,
  professionalId: string | null,
  date: string,
  serviceDuration = 30,
  unitId: string | null = null
): Promise<Slot[]> {
  const dayName = getDayName(date);

  const [shopHour, shop] = await Promise.all([
    prisma.shopHour.findUnique({ where: { shopId_day: { shopId, day: dayName } } }),
    prisma.shop.findUnique({ where: { id: shopId }, select: { bookingBuffer: true } }),
  ]);

  if (!shopHour || !shopHour.start || !shopHour.end) {
    return [];
  }

  const allSlots = generateSlots(shopHour.start, shopHour.end);

  const bufferMinutes = shop?.bookingBuffer ?? 0;

  const nowTz = getNowInTimezone(SHOP_TIMEZONE);
  const isToday = date === nowTz.dateStr;
  let filteredSlots = allSlots;
  if (isToday) {
    filteredSlots = allSlots.filter((time) => timeToMinutes(time) > nowTz.minutes + bufferMinutes);
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
  const profWhere: Record<string, unknown> = { shopId, active: true, deletedAt: null };
  if (unitId) {
    profWhere.OR = [
      { unitId },
      { professionalUnits: { some: { unitId } } },
    ];
  }

  const professionals = await prisma.professional.findMany({
    where: profWhere,
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
  endDate: string,
  unitId: string | null = null
): Promise<string[]> {
  const dates: string[] = [];
  const current = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  const results = await Promise.all(
    dates.map((dateStr) => getAvailableSlots(shopId, professionalId, dateStr, 30, unitId))
  );

  return dates.filter((_, i) => !results[i].some((s) => s.available));
}
