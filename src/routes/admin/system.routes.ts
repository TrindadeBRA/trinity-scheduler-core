import { Router } from 'express';
import { prisma } from '../../utils/prisma';
import { authMiddleware } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';

const router = Router();

/**
 * @swagger
 * /admin/system/complete-past-appointments:
 *   post:
 *     summary: Marca agendamentos de dias anteriores como concluídos (execução manual do cron)
 *     tags: [Admin - System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agendamentos atualizados com sucesso
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão (apenas admin)
 */
router.post(
  '/complete-past-appointments',
  authMiddleware,
  authorize('admin'),
  async (req, res, next) => {
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

      res.json({
        success: true,
        message: `${result.count} agendamentos de dias anteriores marcados como concluídos`,
        beforeDate: todayStr,
        count: result.count,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
