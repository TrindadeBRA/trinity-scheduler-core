import { Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';

type ResourceType = 'unit' | 'professional';

const FREE_PLAN_ID = 'FREE';

export function limitMiddleware(resource: ResourceType): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return next(new AppError(401, 'UNAUTHORIZED', 'Não autenticado'));
      }

      const { id: userId, shopId } = req.user;

      // Fetch the user's active plan, fallback to FREE if not found
      const userPlan = await prisma.userPlan.findUnique({
        where: { userId },
        include: { plan: true },
      });

      const plan = userPlan?.plan ?? await prisma.plan.findUnique({ where: { id: FREE_PLAN_ID } });

      if (!plan) {
        // No plan found at all — allow creation (fail open)
        return next();
      }

      const limit = resource === 'unit' ? plan.unitLimit : plan.professionalLimit;

      // -1 means unlimited
      if (limit === -1) {
        return next();
      }

      const count =
        resource === 'unit'
          ? await prisma.unit.count({ where: { shopId } })
          : await prisma.professional.count({ where: { shopId, deletedAt: null } });

      if (count >= limit) {
        const resourceLabel = resource === 'unit' ? 'unidades' : 'profissionais';
        return next(
          new AppError(
            403,
            'PLAN_LIMIT_EXCEEDED',
            `Limite de ${resourceLabel} do plano atingido. Faça upgrade para continuar.`,
          ),
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
