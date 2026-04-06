import cron from 'node-cron';
import { prisma } from '../utils/prisma';

const TAG = '[CRON]';
const ts = () => new Date().toISOString();

/**
 * Marca como 'completed' todos os agendamentos confirmados de dias anteriores a hoje.
 */
export async function completePastAppointments(): Promise<{ count: number; beforeDate: string }> {
  const todayStr = new Date().toISOString().split('T')[0];

  console.log(`${TAG} ${ts()} completePastAppointments — buscando agendamentos confirmados anteriores a ${todayStr}...`);

  const toComplete = await prisma.appointment.findMany({
    where: { date: { lt: todayStr }, status: 'confirmed' },
    select: { id: true },
  });

  if (toComplete.length === 0) {
    console.log(`${TAG} ${ts()} completePastAppointments — nenhum agendamento pendente para concluir.`);
    return { count: 0, beforeDate: todayStr };
  }

  const ids = toComplete.map((a) => a.id);

  await prisma.appointment.updateMany({
    where: { id: { in: ids } },
    data: { status: 'completed' },
  });

  console.log(`${TAG} ${ts()} completePastAppointments — ${ids.length} agendamento(s) marcado(s) como concluído(s) (corte: < ${todayStr}).`);
  return { count: ids.length, beforeDate: todayStr };
}

/**
 * Recalcula totalSpent e lastVisit de todos os clientes com base nos agendamentos completed.
 * Usa uma query agregada e atualiza cada cliente numa transaction.
 */
export async function syncClientTotals(): Promise<{ clientsUpdated: number }> {
  console.log(`${TAG} ${ts()} syncClientTotals — agregando totais de agendamentos concluídos...`);

  const aggregated = await prisma.appointment.groupBy({
    by: ['clientId'],
    where: { status: 'completed' },
    _sum: { price: true },
    _max: { date: true },
  });

  if (aggregated.length === 0) {
    console.log(`${TAG} ${ts()} syncClientTotals — nenhum agendamento concluído encontrado, nada a atualizar.`);
    return { clientsUpdated: 0 };
  }

  // Soma addons por cliente (groupBy não suporta relações)
  const addonTotals = await prisma.appointmentAddon.groupBy({
    by: ['appointmentId'],
    _sum: { price: true },
    where: { appointment: { status: 'completed' } },
  });

  const addonByAppointment = new Map(addonTotals.map((a) => [a.appointmentId, a._sum.price ?? 0]));

  const completedAppointments = await prisma.appointment.findMany({
    where: { status: 'completed' },
    select: { id: true, clientId: true },
  });

  const clientAddonMap = new Map<string, number>();
  for (const appt of completedAppointments) {
    const addonPrice = addonByAppointment.get(appt.id) ?? 0;
    clientAddonMap.set(appt.clientId, (clientAddonMap.get(appt.clientId) ?? 0) + addonPrice);
  }

  await prisma.$transaction(
    aggregated.map((row) => {
      const serviceTotal = row._sum.price ?? 0;
      const addonTotal = clientAddonMap.get(row.clientId) ?? 0;
      return prisma.client.update({
        where: { id: row.clientId },
        data: {
          totalSpent: serviceTotal + addonTotal,
          lastVisit: row._max.date ? new Date(row._max.date + 'T12:00:00Z') : undefined,
        },
      });
    }),
  );

  const totalCents = aggregated.reduce((s, r) => s + (r._sum.price ?? 0), 0) +
    Array.from(clientAddonMap.values()).reduce((s, v) => s + v, 0);

  console.log(
    `${TAG} ${ts()} syncClientTotals — ${aggregated.length} cliente(s) atualizado(s) ` +
    `(${completedAppointments.length} agendamentos concluídos, ${addonTotals.length} addon(s), ` +
    `total geral: R$ ${(totalCents / 100).toFixed(2)}).`,
  );

  return { clientsUpdated: aggregated.length };
}

/**
 * Expira pacotes mensais cujo packageExpiresAt já passou,
 * revertendo o UserPlan para o plano FREE.
 */
export async function expirePackages(): Promise<{ count: number }> {
  const now = new Date();
  const result = await prisma.userPlan.updateMany({
    where: {
      isPackage: true,
      packageExpiresAt: { lt: now },
    },
    data: {
      planId: 'FREE',
      isPackage: false,
      packageExpiresAt: null,
      subscriptionStatus: 'TRIAL',
    },
  });
  console.log(`[cron] expirePackages: ${result.count} pacotes expirados processados`);
  return { count: result.count };
}

/**
 * Inicializa os cron jobs da aplicação.
 */
export function initCronJobs() {
  cron.schedule('0 0 * * *', async () => {
    console.log(`${TAG} ${ts()} ── Rotina diária iniciada ──`);
    try {
      await completePastAppointments();
      await syncClientTotals();
      await expirePackages();
      console.log(`${TAG} ${ts()} ── Rotina diária finalizada com sucesso ──`);
    } catch (error) {
      console.error(`${TAG} ${ts()} ── Rotina diária falhou ──`, error);
    }
  }, {
    timezone: 'America/Sao_Paulo',
  });

  console.log(`${TAG} Cron agendado — todo dia às 00:00 (America/Sao_Paulo)`);
}
