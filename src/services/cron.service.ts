import cron from 'node-cron';
import { prisma } from '../utils/prisma';

/**
 * Atualiza o status dos agendamentos de dias anteriores para 'completed'
 */
async function completePastAppointments() {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const result = await prisma.appointment.updateMany({
      where: {
        date: { lt: todayStr }, // Todos os dias anteriores a hoje
        status: 'confirmed',
      },
      data: {
        status: 'completed',
      },
    });

    console.log(`[CRON] ${new Date().toISOString()} - ${result.count} agendamentos de dias anteriores marcados como concluídos`);
  } catch (error) {
    console.error('[CRON] Erro ao atualizar agendamentos:', error);
  }
}

/**
 * Inicializa os cron jobs da aplicação
 */
export function initCronJobs() {
  // Executa todo dia às 00:00
  cron.schedule('0 0 * * *', completePastAppointments, {
    timezone: 'America/Sao_Paulo',
  });

  console.log('[CRON] Jobs agendados com sucesso');
}
