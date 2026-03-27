import cron from 'node-cron';
import { prisma } from '../utils/prisma';

/**
 * Atualiza o status dos agendamentos de dias anteriores para 'completed'.
 * Exportada para permitir execução manual via endpoint admin.
 */
export async function completePastAppointments(): Promise<{ count: number; beforeDate: string }> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const result = await prisma.appointment.updateMany({
    where: {
      date: { lt: todayStr },
      status: 'confirmed',
    },
    data: { status: 'completed' },
  });

  console.log(`[CRON] ${new Date().toISOString()} - ${result.count} agendamentos de dias anteriores marcados como concluídos`);
  return { count: result.count, beforeDate: todayStr };
}

/**
 * Inicializa os cron jobs da aplicação
 */
export function initCronJobs() {
  // Executa todo dia às 00:00
  cron.schedule('0 0 * * *', async () => {
    try {
      await completePastAppointments();
    } catch (error) {
      console.error('[CRON] Erro ao atualizar agendamentos:', error);
    }
  }, {
    timezone: 'America/Sao_Paulo',
  });

  console.log('[CRON] Jobs agendados com sucesso');
}
