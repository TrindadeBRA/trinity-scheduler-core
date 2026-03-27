import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { completePastAppointments } from '../../services/cron.service';

const router = Router();

/**
 * @swagger
 * /admin/system/complete-past-appointments:
 *   post:
 *     summary: Concluir agendamentos passados manualmente
 *     description: |
 *       Executa manualmente a rotina do cron que marca como `completed` todos os
 *       agendamentos com status `confirmed` de datas anteriores a hoje.
 *
 *       Equivalente à execução automática que ocorre todo dia às 00:00 (America/Sao_Paulo).
 *
 *       **Acesso restrito:** apenas usuários com role `admin`.
 *     tags: [Admin - System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rotina executada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "42 agendamentos de dias anteriores marcados como concluídos"
 *                 count:
 *                   type: integer
 *                   description: Número de agendamentos atualizados
 *                   example: 42
 *                 beforeDate:
 *                   type: string
 *                   format: date
 *                   description: Data de corte usada (hoje)
 *                   example: "2026-03-27"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  '/complete-past-appointments',
  authMiddleware,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const { count, beforeDate } = await completePastAppointments();
      res.json({
        success: true,
        message: `${count} agendamentos de dias anteriores marcados como concluídos`,
        count,
        beforeDate,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
