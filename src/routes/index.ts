import { Express } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { tenantFilter } from '../middlewares/tenantFilter';
import { shopResolver } from '../middlewares/shopResolver';

// Public routes
import publicRouter from './public.routes';

// Client routes
import clientAuthRouter from './client/auth.routes';
import clientServicesRouter from './client/services.routes';
import clientAddonsRouter from './client/addons.routes';
import clientProfessionalsRouter from './client/professionals.routes';
import clientAvailabilityRouter from './client/availability.routes';
import clientAppointmentsRouter from './client/appointments.routes';
import clientShopRouter from './client/shop.routes';
import clientUnitsRouter from './client/units.routes';

// Admin routes
import adminAuthRouter from './admin/auth.routes';
import adminShopRouter from './admin/shop.routes';
import adminAppointmentsRouter from './admin/appointments.routes';
import adminClientsRouter from './admin/clients.routes';
import adminServicesRouter from './admin/services.routes';
import adminProfessionalsRouter from './admin/professionals.routes';
import adminUnitsRouter from './admin/units.routes';
import adminDashboardRouter from './admin/dashboard.routes';
import adminRevenueRouter from './admin/revenue.routes';
import adminUploadRouter from './admin/upload.routes';
import adminSystemRouter from './admin/system.routes';

export function mountRoutes(app: Express): void {
  // ─── Public routes (no authentication required) ──────────────────────────
  app.use('/public', publicRouter);

  // ─── Client routes (public - no shopResolver, no auth) ───────────────────
  app.use('/client/units', clientUnitsRouter);

  // ─── Client routes (shopResolver required) ───────────────────────────────
  app.use('/auth', shopResolver, clientAuthRouter);
  app.use('/services', shopResolver, clientServicesRouter);
  app.use('/addons', shopResolver, clientAddonsRouter);
  app.use('/professionals', shopResolver, clientProfessionalsRouter);
  app.use('/availability', shopResolver, clientAvailabilityRouter);
  app.use('/appointments', shopResolver, clientAppointmentsRouter);
  app.use('/client/shop', shopResolver, clientShopRouter);

  // ─── Admin auth (public — no authMiddleware) ──────────────────────────────
  app.use('/admin/auth', adminAuthRouter);

  // ─── Admin routes (authMiddleware + tenantFilter) ─────────────────────────
  app.use('/admin', authMiddleware, tenantFilter, adminShopRouter);
  app.use('/admin', authMiddleware, tenantFilter, adminAppointmentsRouter);
  app.use('/admin', authMiddleware, tenantFilter, adminClientsRouter);
  app.use('/admin', authMiddleware, tenantFilter, adminServicesRouter);
  app.use('/admin', authMiddleware, tenantFilter, adminProfessionalsRouter);
  app.use('/admin', authMiddleware, tenantFilter, adminUnitsRouter);
  app.use('/admin', authMiddleware, tenantFilter, adminDashboardRouter);
  app.use('/admin', authMiddleware, tenantFilter, adminRevenueRouter);
  app.use('/admin', authMiddleware, tenantFilter, adminUploadRouter);
  app.use('/admin/system', adminSystemRouter);
}
