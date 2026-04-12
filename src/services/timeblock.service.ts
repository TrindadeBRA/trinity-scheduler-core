import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { randomUUID } from 'crypto';

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function getDayName(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return DAY_NAMES[d.getDay()];
}

export interface RecurrenceInput {
  startDate: string;
  recurrenceDays: string[];
  recurrenceEndDate: string;
}

export function generateRecurrenceDates(input: RecurrenceInput): string[] {
  const { startDate, recurrenceDays, recurrenceEndDate } = input;
  const dates: string[] = [];
  const current = new Date(startDate + 'T12:00:00');
  const end = new Date(recurrenceEndDate + 'T12:00:00');

  while (current <= end) {
    const dayName = DAY_NAMES[current.getDay()];
    if (recurrenceDays.includes(dayName)) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export interface AppointmentConflict {
  date: string;
  time: string;
  clientName: string;
  serviceName: string;
}

export async function checkAppointmentConflicts(data: {
  professionalId: string;
  dates: string[];
  startTime: string;
  duration: number;
}): Promise<AppointmentConflict[]> {
  const { professionalId, dates, startTime, duration } = data;

  if (dates.length === 0) return [];

  const blockStart = timeToMinutes(startTime);
  const blockEnd = blockStart + duration;

  const appointments = await prisma.appointment.findMany({
    where: {
      professionalId,
      date: { in: dates },
      status: { in: ['confirmed'] },
    },
    select: {
      date: true,
      time: true,
      duration: true,
      client: { select: { name: true } },
      service: { select: { name: true } },
    },
  });

  const conflicts: AppointmentConflict[] = [];

  for (const appt of appointments) {
    const apptStart = timeToMinutes(appt.time);
    const apptEnd = apptStart + appt.duration;

    if (apptStart < blockEnd && blockStart < apptEnd) {
      conflicts.push({
        date: appt.date,
        time: appt.time,
        clientName: appt.client?.name ?? '',
        serviceName: appt.service?.name ?? '',
      });
    }
  }

  return conflicts;
}

export interface CreateTimeBlocksInput {
  shopId: string;
  professionalId: string;
  date: string;
  startTime: string;
  duration: number;
  reason?: string;
  recurrenceDays?: string[];
  recurrenceEndDate?: string;
}

export async function createTimeBlocks(data: CreateTimeBlocksInput) {
  const { shopId, professionalId, date, startTime, duration, reason, recurrenceDays, recurrenceEndDate } = data;

  const hasRecurrence = recurrenceDays && recurrenceDays.length > 0;

  if (hasRecurrence && !recurrenceEndDate) {
    throw new AppError(400, 'VALIDATION_ERROR', 'recurrenceEndDate é obrigatório quando recurrenceDays está preenchido');
  }

  if (hasRecurrence && recurrenceEndDate) {
    if (recurrenceEndDate <= date) {
      throw new AppError(400, 'VALIDATION_ERROR', 'recurrenceEndDate deve ser posterior à data do bloqueio');
    }

    const startMs = new Date(date + 'T12:00:00').getTime();
    const endMs = new Date(recurrenceEndDate + 'T12:00:00').getTime();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    if (endMs - startMs > oneYearMs) {
      throw new AppError(400, 'VALIDATION_ERROR', 'recurrenceEndDate não pode exceder 1 ano a partir da data atual');
    }
  }

  if (!hasRecurrence) {
    const conflicts = await checkAppointmentConflicts({ professionalId, dates: [date], startTime, duration });
    if (conflicts.length > 0) {
      throw new AppError(409, 'CONFLICT', 'Existem agendamentos que conflitam com o bloqueio', { conflicts });
    }

    return prisma.timeBlock.create({
      data: { shopId, professionalId, date, startTime, duration, reason },
    });
  }

  const dates = generateRecurrenceDates({
    startDate: date,
    recurrenceDays: recurrenceDays!,
    recurrenceEndDate: recurrenceEndDate!,
  });

  if (dates.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Nenhuma data corresponde aos dias de recorrência selecionados');
  }

  const conflicts = await checkAppointmentConflicts({ professionalId, dates, startTime, duration });
  if (conflicts.length > 0) {
    throw new AppError(409, 'CONFLICT', 'Existem agendamentos que conflitam com o bloqueio', { conflicts });
  }

  const recurrenceGroupId = randomUUID();

  const blocks = dates.map((d) => ({
    shopId,
    professionalId,
    date: d,
    startTime,
    duration,
    reason,
    recurrenceGroupId,
    recurrenceDays: recurrenceDays!,
    recurrenceEndDate: recurrenceEndDate!,
  }));

  return prisma.$transaction(
    blocks.map((b) => prisma.timeBlock.create({ data: b }))
  );
}
