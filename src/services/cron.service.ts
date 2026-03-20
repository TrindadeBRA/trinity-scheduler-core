import cron from 'node-cron';
import { prisma } from '../utils/prisma';

/**
 * Atualiza o status dos agendamentos do dia anterior para 'completed'
 */
async function completeYesterdayAppointments() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const result = await prisma.appointment.updateMany({
      where: {
        date: yesterdayStr,
        status: 'confirmed',
      },
      data: {
        status: 'completed',
      },
    });

    console.log(`[CRON] ${new Date().toISOString()} - ${result.count} agendamentos do dia ${yesterdayStr} marcados como concluídos`);
  } catch (error) {
    console.error('[CRON] Erro ao atualizar agendamentos:', error);
  }
}

/**
 * Inicializa os cron jobs da aplicação
 */
export function initCronJobs() {
  // Executa todo dia às 00:00
  cron.schedule('0 0 * * *', completeYesterdayAppointments, {
    timezone: 'America/Sao_Paulo',
  });

  console.log('[CRON] Jobs agendados com sucesso');
}
