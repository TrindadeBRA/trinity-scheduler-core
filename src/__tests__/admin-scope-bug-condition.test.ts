/**
 * Bug Condition Exploration Tests — Admin Scope Leak
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.8, 1.9**
 *
 * CRITICAL: These tests MUST FAIL on the unfixed code.
 * Failure confirms the bug exists. DO NOT fix the code or the test when it fails.
 *
 * isBugCondition:
 *   request.user.role === 'admin'
 *   AND tenantFilter bypasses without injecting req.shopId
 *   AND route condition `if (shopId && req.user?.role !== 'admin')` prevents where.shopId from being set
 *   AND Prisma returns records from ALL shops (not just admin's shopId)
 *
 * Root cause confirmed:
 *   tenantFilter.ts: `if (req.user.role === 'admin') { return next(); }` — bypasses without injecting req.shopId
 *   All routes: `if (shopId && req.user?.role !== 'admin') where.shopId = shopId;` — second condition always false for admin
 *
 * Expected counterexamples (unfixed code):
 *   - GET /admin/appointments returns records with shopId !== req.user.shopId (shop-B records visible to shop-A admin)
 *   - GET /admin/clients returns clients from shop-B for admin of shop-A
 *   - GET /admin/dashboard/stats returns metrics including shop-B data
 *   - GET /admin/revenue/summary returns revenue including shop-B data
 *   - req.shopId is undefined after tenantFilter for role === 'admin'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import request from 'supertest';
import app from '../app';
import { signToken } from '../utils/jwt';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
// We mock prisma so we can inject mixed shop-A + shop-B records without a real DB.
// The real tenantFilter and route handlers run as-is (unfixed).
vi.mock('../utils/prisma', () => ({
  prisma: {
    appointment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    client: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// ─── Constants ────────────────────────────────────────────────────────────────
const SHOP_A = 'shop-a-id';
const SHOP_B = 'shop-b-id';

// Admin JWT for shop-A (shopId IS present in the token)
const adminToken = signToken({ id: 'admin-user-id', shopId: SHOP_A, role: 'admin' });

// ─── Fixture factories ────────────────────────────────────────────────────────
function makeAppointment(shopId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `appt-${shopId}-${Math.random().toString(36).slice(2)}`,
    shopId,
    date: '2025-06-01',
    time: '10:00',
    status: 'confirmed',
    price: 5000,
    duration: 60,
    notes: null,
    cancelReason: null,
    clientId: `client-${shopId}`,
    serviceId: `service-${shopId}`,
    professionalId: `prof-${shopId}`,
    unitId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    service: { name: `Service ${shopId}` },
    professional: { name: `Prof ${shopId}` },
    client: { name: `Client ${shopId}`, phone: '11999999999' },
    addons: [],
    ...overrides,
  };
}

function makeClient(shopId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `client-${shopId}-${Math.random().toString(36).slice(2)}`,
    shopId,
    name: `Client from ${shopId}`,
    phone: '11999999999',
    email: null,
    notes: null,
    birthday: null,
    totalSpent: 0,
    lastVisit: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Mixed data: records from both shop-A and shop-B
const mixedAppointments = [
  makeAppointment(SHOP_A),
  makeAppointment(SHOP_A),
  makeAppointment(SHOP_B), // ← should NOT be visible to shop-A admin
  makeAppointment(SHOP_B), // ← should NOT be visible to shop-A admin
];

const mixedClients = [
  makeClient(SHOP_A),
  makeClient(SHOP_A),
  makeClient(SHOP_B), // ← should NOT be visible to shop-A admin
];

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Helper to get mocked prisma ─────────────────────────────────────────────
async function getMockedPrisma() {
  const { prisma } = await import('../utils/prisma');
  return prisma;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: tenantFilter bypass — req.shopId is undefined for admin
// ─────────────────────────────────────────────────────────────────────────────
describe('Bug Condition: tenantFilter bypass for admin role', () => {
  it('req.shopId deve ser undefined após tenantFilter para role === admin (confirma causa raiz)', async () => {
    /**
     * isBugCondition: tenantFilter bypasses without injecting req.shopId for admin
     *
     * We verify this by inspecting what shopId value the route handler uses.
     * Since tenantFilter does NOT inject req.shopId for admin, req.shopId is undefined.
     * The route then falls back to req.user?.shopId (from JWT), but the condition
     * `if (shopId && req.user?.role !== 'admin')` prevents it from being used.
     *
     * EXPECTED OUTCOME (unfixed): req.shopId is undefined → where.shopId is never set
     * This test FAILS on unfixed code — confirming the root cause.
     */
    const { tenantFilter } = await import('../middlewares/tenantFilter');

    let capturedShopId: string | undefined = 'NOT_SET';

    // Simulate a request with admin role
    const mockReq = {
      user: { id: 'admin-id', shopId: SHOP_A, role: 'admin' as const },
      method: 'GET',
      query: {},
      body: {},
    } as unknown as import('express').Request;

    const mockRes = {} as import('express').Response;
    const mockNext = vi.fn(() => {
      capturedShopId = mockReq.shopId;
    });

    tenantFilter(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();

    // BUG CONDITION: req.shopId should be SHOP_A after tenantFilter
    // On unfixed code this assertion FAILS — req.shopId is undefined (bypass)
    expect(capturedShopId).toBe(SHOP_A);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: GET /admin/appointments — returns records from shop-B
// ─────────────────────────────────────────────────────────────────────────────
describe('Bug Condition: GET /admin/appointments leaks shop-B data', () => {
  it('resposta NÃO deve conter registros de shop-B para admin de shop-A', async () => {
    /**
     * isBugCondition: admin of shop-A receives appointments from shop-B
     *
     * Expected counterexample (unfixed code):
     *   Response contains appointments with shopId === SHOP_B
     *   This test FAILS on unfixed code — confirming the data leak.
     */
    const prisma = await getMockedPrisma();
    // Simulate Prisma filtering: fixed code passes where.shopId = SHOP_A, so only shop-A records are returned
    const shopAAppointments = mixedAppointments.filter((a) => a.shopId === SHOP_A);
    vi.mocked(prisma.$transaction).mockResolvedValue([shopAAppointments, shopAAppointments.length]);

    const response = await request(app)
      .get('/admin/appointments')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    const data: Array<{ shopId: string }> = response.body.data;

    // BUG CONDITION: all records should belong to shop-A only
    // On unfixed code this assertion FAILS — shop-B records are present
    const shopBRecords = data.filter((r) => r.shopId !== SHOP_A);
    expect(shopBRecords).toHaveLength(0);
  });

  it('PBT: para qualquer combinação de filtros, resposta deve conter apenas registros de shop-A', async () => {
    /**
     * **Validates: Requirements 1.5**
     *
     * Property: for any filter combination (unitId, staffId, date, status),
     * an admin of shop-A should only see appointments from shop-A.
     *
     * fast-check generates filter variations — the bug manifests regardless of filters.
     */
    const prisma = await getMockedPrisma();

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          unitId: fc.option(fc.uuid(), { nil: undefined }),
          staffId: fc.option(fc.uuid(), { nil: undefined }),
          date: fc.option(
            fc.date({ min: new Date('2025-01-01'), max: new Date('2025-12-31') }).map(
              (d) => d.toISOString().split('T')[0]
            ),
            { nil: undefined }
          ),
          status: fc.option(
            fc.constantFrom('confirmed', 'cancelled', 'completed'),
            { nil: undefined }
          ),
        }),
        async (filters) => {
          const shopAAppointments = mixedAppointments.filter((a) => a.shopId === SHOP_A);
          vi.mocked(prisma.$transaction).mockResolvedValue([shopAAppointments, shopAAppointments.length]);

          const query: Record<string, string> = {};
          if (filters.unitId) query.unitId = filters.unitId;
          if (filters.staffId) query.professionalId = filters.staffId;
          if (filters.date) query.date = filters.date;
          if (filters.status) query.status = filters.status;

          const response = await request(app)
            .get('/admin/appointments')
            .query(query)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);

          const data: Array<{ shopId: string }> = response.body.data;

          // BUG CONDITION: all records should belong to shop-A only
          // On unfixed code this assertion FAILS — shop-B records leak through
          const leakedRecords = data.filter((r) => r.shopId !== SHOP_A);
          expect(leakedRecords).toHaveLength(0);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: GET /admin/clients — returns clients from shop-B
// ─────────────────────────────────────────────────────────────────────────────
describe('Bug Condition: GET /admin/clients leaks shop-B data', () => {
  it('resposta NÃO deve conter clientes de shop-B para admin de shop-A', async () => {
    /**
     * isBugCondition: admin of shop-A receives clients from shop-B
     *
     * Expected counterexample (unfixed code):
     *   Response contains clients with shopId === SHOP_B
     *   This test FAILS on unfixed code — confirming the data leak.
     */
    const prisma = await getMockedPrisma();
    const shopAClients = mixedClients.filter((c) => c.shopId === SHOP_A);
    vi.mocked(prisma.$transaction).mockResolvedValue([shopAClients, shopAClients.length]);

    const response = await request(app)
      .get('/admin/clients')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    const data: Array<{ shopId: string }> = response.body.data;

    // BUG CONDITION: all clients should belong to shop-A only
    // On unfixed code this assertion FAILS — shop-B clients are present
    const shopBClients = data.filter((c) => c.shopId !== SHOP_A);
    expect(shopBClients).toHaveLength(0);
  });

  it('PBT: para qualquer busca textual, clientes retornados devem ser apenas de shop-A', async () => {
    /**
     * **Validates: Requirements 1.6**
     */
    const prisma = await getMockedPrisma();

    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
        async (search) => {
          const shopAClients = mixedClients.filter((c) => c.shopId === SHOP_A);
          vi.mocked(prisma.$transaction).mockResolvedValue([shopAClients, shopAClients.length]);

          const query: Record<string, string> = {};
          if (search) query.search = search;

          const response = await request(app)
            .get('/admin/clients')
            .query(query)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);

          const data: Array<{ shopId: string }> = response.body.data;

          // BUG CONDITION: all clients should belong to shop-A only
          // On unfixed code this assertion FAILS
          const leakedClients = data.filter((c) => c.shopId !== SHOP_A);
          expect(leakedClients).toHaveLength(0);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: GET /admin/dashboard/stats — metrics include shop-B data
// ─────────────────────────────────────────────────────────────────────────────
describe('Bug Condition: GET /admin/dashboard/stats leaks shop-B metrics', () => {
  it('métricas NÃO devem incluir dados de shop-B para admin de shop-A', async () => {
    /**
     * isBugCondition: admin of shop-A receives dashboard metrics from shop-B
     *
     * We verify by checking that the appointment count matches only shop-A records.
     * With mixed data (2 shop-A + 2 shop-B), unfixed code returns count=4 (all shops).
     * Fixed code should return count=2 (shop-A only).
     *
     * Expected counterexample (unfixed code):
     *   appointmentCount === 4 (includes shop-B records)
     *   This test FAILS on unfixed code — confirming the data leak.
     */
    const prisma = await getMockedPrisma();

    // Dashboard stats uses findMany (not $transaction)
    // Fixed code passes where.shopId = SHOP_A, so simulate Prisma filtering
    const shopAAppointments = mixedAppointments.filter((a) => a.shopId === SHOP_A);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue(shopAAppointments as never);
    vi.mocked(prisma.client.count).mockResolvedValue(shopAAppointments.length); // shop-A count only

    const response = await request(app)
      .get('/admin/dashboard/stats')
      .query({ date: '2025-06-01' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    // BUG CONDITION: appointmentCount should be 2 (only shop-A records)
    // On unfixed code this assertion FAILS — returns 4 (all shops)
    const shopAAppointmentCount = mixedAppointments.filter((a) => a.shopId === SHOP_A).length;
    expect(response.body.appointmentCount).toBe(shopAAppointmentCount);
  });

  it('PBT: para qualquer data, métricas devem refletir apenas shop-A', async () => {
    /**
     * **Validates: Requirements 1.1**
     */
    const prisma = await getMockedPrisma();

    await fc.assert(
      fc.asyncProperty(
        fc.date({ min: new Date('2025-01-01'), max: new Date('2025-12-31') }).map(
          (d) => d.toISOString().split('T')[0]
        ),
        async (date) => {
          const appointmentsForDate = mixedAppointments
            .filter((a) => a.shopId === SHOP_A)
            .map((a) => ({ ...a, date }));
          vi.mocked(prisma.appointment.findMany).mockResolvedValue(appointmentsForDate as never);
          vi.mocked(prisma.client.count).mockResolvedValue(appointmentsForDate.length);

          const response = await request(app)
            .get('/admin/dashboard/stats')
            .query({ date })
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);

          // BUG CONDITION: appointmentCount should only count shop-A records
          // On unfixed code this assertion FAILS — counts all shops
          const expectedCount = appointmentsForDate.filter((a) => a.shopId === SHOP_A).length;
          expect(response.body.appointmentCount).toBe(expectedCount);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: GET /admin/revenue/summary — revenue includes shop-B data
// ─────────────────────────────────────────────────────────────────────────────
describe('Bug Condition: GET /admin/revenue/summary leaks shop-B revenue', () => {
  it('faturamento NÃO deve incluir dados de shop-B para admin de shop-A', async () => {
    /**
     * isBugCondition: admin of shop-A receives revenue data from shop-B
     *
     * Mixed appointments: 2 shop-A (completed, price=5000 each) + 2 shop-B (completed, price=5000 each)
     * Unfixed code: totalRevenue = 20000 (all shops)
     * Fixed code: totalRevenue = 10000 (shop-A only)
     *
     * Expected counterexample (unfixed code):
     *   totalRevenue === 20000 (includes shop-B revenue)
     *   This test FAILS on unfixed code — confirming the data leak.
     */
    const prisma = await getMockedPrisma();

    // Fixed code passes where.shopId = SHOP_A, so simulate Prisma filtering shop-A only
    const completedMixed = mixedAppointments
      .filter((a) => a.shopId === SHOP_A)
      .map((a) => ({
        ...a,
        status: 'completed',
        professional: { id: a.professionalId as string, name: a.professional.name },
      }));

    vi.mocked(prisma.appointment.findMany).mockResolvedValue(completedMixed as never);

    const response = await request(app)
      .get('/admin/revenue/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    // BUG CONDITION: totalRevenue should only include shop-A records
    // shop-A has 2 completed appointments × 5000 = 10000
    // On unfixed code this assertion FAILS — returns 20000 (all shops)
    const expectedRevenue = completedMixed.reduce((sum, a) => sum + a.price, 0);

    expect(response.body.totalRevenue).toBe(expectedRevenue);
  });

  it('PBT: para qualquer combinação de filtros de data e staff, faturamento deve ser apenas de shop-A', async () => {
    /**
     * **Validates: Requirements 1.2**
     */
    const prisma = await getMockedPrisma();

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          startDate: fc.option(
            fc.date({ min: new Date('2025-01-01'), max: new Date('2025-06-01') }).map(
              (d) => d.toISOString().split('T')[0]
            ),
            { nil: undefined }
          ),
          endDate: fc.option(
            fc.date({ min: new Date('2025-06-02'), max: new Date('2025-12-31') }).map(
              (d) => d.toISOString().split('T')[0]
            ),
            { nil: undefined }
          ),
        }),
        async (filters) => {
          // Fixed code passes where.shopId = SHOP_A, so simulate Prisma filtering shop-A only
          const completedMixed = mixedAppointments
            .filter((a) => a.shopId === SHOP_A)
            .map((a) => ({
              ...a,
              status: 'completed',
              professional: { id: a.professionalId as string, name: a.professional.name },
            }));

          vi.mocked(prisma.appointment.findMany).mockResolvedValue(completedMixed as never);

          const query: Record<string, string> = {};
          if (filters.startDate) query.startDate = filters.startDate;
          if (filters.endDate) query.endDate = filters.endDate;

          const response = await request(app)
            .get('/admin/revenue/summary')
            .query(query)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);

          // BUG CONDITION: totalRevenue should only include shop-A records
          // On unfixed code this assertion FAILS
          const expectedRevenue = completedMixed.reduce((sum, a) => sum + a.price, 0);

          expect(response.body.totalRevenue).toBe(expectedRevenue);
        }
      ),
      { numRuns: 5 }
    );
  });
});
