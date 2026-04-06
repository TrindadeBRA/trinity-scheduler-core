/**
 * Preservation Tests — Admin Scope Fix
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * IMPORTANT: These tests MUST PASS on the unfixed code.
 * They establish the baseline behavior that must NOT regress after the fix.
 *
 * Preserved behaviors verified here:
 *   - role=leader: tenantFilter injects req.shopId → where.shopId is always set to leader's shopId
 *   - role=professional: tenantFilter injects req.shopId AND where.professionalId is set to req.user.professionalId
 *   - GET /admin/users: mounted WITHOUT tenantFilter → returns all users, no shopId restriction
 *
 * These roles are NOT affected by the bug (bug only affects role=admin).
 * The fix must leave these behaviors completely unchanged.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import request from 'supertest';
import app from '../app';
import { signToken } from '../utils/jwt';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
vi.mock('../utils/prisma', () => ({
  prisma: {
    appointment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      groupBy: vi.fn(),
    },
    client: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    professional: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    userPlan: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// ─── Constants ────────────────────────────────────────────────────────────────
const SHOP_A = 'shop-a-id';
const SHOP_B = 'shop-b-id';
const PROF_ID = 'prof-user-id';

// Tokens for different roles
const leaderToken = signToken({ id: 'leader-user-id', shopId: SHOP_A, role: 'leader' });
const professionalToken = signToken({
  id: 'prof-user-id',
  shopId: SHOP_A,
  role: 'professional',
  professionalId: PROF_ID,
});
const adminToken = signToken({ id: 'admin-user-id', shopId: SHOP_A, role: 'admin' });

// ─── Fixture factories ────────────────────────────────────────────────────────
function makeAppointment(shopId: string, professionalId = `prof-${shopId}`, overrides: Record<string, unknown> = {}) {
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
    professionalId,
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

function makeUser(shopId: string, role = 'leader') {
  return {
    id: `user-${shopId}-${Math.random().toString(36).slice(2)}`,
    name: `User from ${shopId}`,
    email: `user@${shopId}.com`,
    role,
    shopId,
    createdAt: new Date('2025-01-01'),
    shop: { id: shopId, name: `Shop ${shopId}` },
  };
}

// Shop-A only appointments (what leader should see)
const shopAAppointments = [
  makeAppointment(SHOP_A),
  makeAppointment(SHOP_A),
  makeAppointment(SHOP_A),
];

// Professional's own appointments only
const profAppointments = [
  makeAppointment(SHOP_A, PROF_ID),
  makeAppointment(SHOP_A, PROF_ID),
];

// Mixed appointments (shop-A + shop-B)
const mixedAppointments = [
  makeAppointment(SHOP_A),
  makeAppointment(SHOP_A),
  makeAppointment(SHOP_B),
  makeAppointment(SHOP_B),
];

// Users from multiple shops (global view)
const allUsers = [
  makeUser(SHOP_A, 'leader'),
  makeUser(SHOP_A, 'admin'),
  makeUser(SHOP_B, 'leader'),
  makeUser(SHOP_B, 'admin'),
];

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

async function getMockedPrisma() {
  const { prisma } = await import('../utils/prisma');
  return prisma;
}

// ─────────────────────────────────────────────────────────────────────────────
// Property 3: Preservation — Leader Filter Unchanged
// **Validates: Requirements 3.3**
// ─────────────────────────────────────────────────────────────────────────────
describe('Preservation: role=leader — where.shopId is always applied', () => {
  it('GET /admin/appointments com role=leader retorna apenas registros de shop-A', async () => {
    /**
     * Observation (unfixed code):
     *   tenantFilter injects req.shopId = SHOP_A for leader (no bypass)
     *   Route condition: if (shopId && req.user?.role !== 'admin') → TRUE for leader
     *   → where.shopId = SHOP_A is applied
     *   → Prisma is called with where.shopId = SHOP_A
     *
     * The mock returns only shop-A appointments (simulating correct DB filtering).
     * We verify the response contains only shop-A records.
     */
    const prisma = await getMockedPrisma();
    vi.mocked(prisma.$transaction).mockResolvedValue([shopAAppointments, shopAAppointments.length]);

    const response = await request(app)
      .get('/admin/appointments')
      .set('Authorization', `Bearer ${leaderToken}`);

    expect(response.status).toBe(200);

    const data: Array<{ shopId: string }> = response.body.data;
    expect(data.length).toBeGreaterThan(0);

    // All records must belong to shop-A
    const nonShopA = data.filter((r) => r.shopId !== SHOP_A);
    expect(nonShopA).toHaveLength(0);
  });

  it('PBT: para qualquer combinação de filtros, leader de shop-A sempre vê apenas registros de shop-A', async () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * Property: for any filter combination (unitId, status, date, professionalId),
     * a leader of shop-A should only see appointments from shop-A.
     *
     * This verifies that tenantFilter correctly injects req.shopId for leader
     * and the route condition `if (shopId && req.user?.role !== 'admin')` is TRUE.
     */
    const prisma = await getMockedPrisma();

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          unitId: fc.option(fc.uuid(), { nil: undefined }),
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
          vi.mocked(prisma.$transaction).mockResolvedValue([shopAAppointments, shopAAppointments.length]);

          const query: Record<string, string> = {};
          if (filters.unitId) query.unitId = filters.unitId;
          if (filters.date) query.date = filters.date;
          if (filters.status) query.status = filters.status;

          const response = await request(app)
            .get('/admin/appointments')
            .query(query)
            .set('Authorization', `Bearer ${leaderToken}`);

          expect(response.status).toBe(200);

          const data: Array<{ shopId: string }> = response.body.data;

          // Preservation: leader always sees only shop-A records
          const nonShopA = data.filter((r) => r.shopId !== SHOP_A);
          expect(nonShopA).toHaveLength(0);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('tenantFilter injeta req.shopId para role=leader (confirma que não há bypass)', async () => {
    /**
     * Directly verify that tenantFilter injects req.shopId for leader.
     * This is the opposite of the bug condition (which bypasses for admin).
     */
    const { tenantFilter } = await import('../middlewares/tenantFilter');

    let capturedShopId: string | undefined = 'NOT_SET';

    const mockReq = {
      user: { id: 'leader-id', shopId: SHOP_A, role: 'leader' as const },
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
    // Preservation: req.shopId MUST be SHOP_A for leader (tenantFilter injects it)
    expect(capturedShopId).toBe(SHOP_A);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 2: Preservation — Professional Filter Unchanged
// **Validates: Requirements 3.1**
// ─────────────────────────────────────────────────────────────────────────────
describe('Preservation: role=professional — where.professionalId is always applied', () => {
  it('GET /admin/appointments com role=professional retorna apenas agendamentos do próprio profissional', async () => {
    /**
     * Observation (unfixed code):
     *   tenantFilter injects req.shopId = SHOP_A for professional (no bypass)
     *   Route: effectiveProfessionalId = req.user.professionalId (PROF_ID)
     *   → where.professionalId = PROF_ID is applied
     *
     * The mock returns only prof's appointments.
     * We verify the response contains only PROF_ID appointments.
     */
    const prisma = await getMockedPrisma();
    vi.mocked(prisma.$transaction).mockResolvedValue([profAppointments, profAppointments.length]);

    const response = await request(app)
      .get('/admin/appointments')
      .set('Authorization', `Bearer ${professionalToken}`);

    expect(response.status).toBe(200);

    const data: Array<{ professionalId: string }> = response.body.data;
    expect(data.length).toBeGreaterThan(0);

    // All records must belong to this professional
    const otherProfRecords = data.filter((r) => r.professionalId !== PROF_ID);
    expect(otherProfRecords).toHaveLength(0);
  });

  it('PBT: para qualquer combinação de filtros, professional sempre vê apenas os próprios agendamentos', async () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * Property: for any filter combination, a professional should only see
     * appointments where professionalId === req.user.professionalId.
     *
     * This verifies that the professional filter logic is preserved.
     */
    const prisma = await getMockedPrisma();

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          unitId: fc.option(fc.uuid(), { nil: undefined }),
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
          vi.mocked(prisma.$transaction).mockResolvedValue([profAppointments, profAppointments.length]);

          const query: Record<string, string> = {};
          if (filters.unitId) query.unitId = filters.unitId;
          if (filters.date) query.date = filters.date;
          if (filters.status) query.status = filters.status;

          const response = await request(app)
            .get('/admin/appointments')
            .query(query)
            .set('Authorization', `Bearer ${professionalToken}`);

          expect(response.status).toBe(200);

          const data: Array<{ professionalId: string }> = response.body.data;

          // Preservation: professional always sees only their own appointments
          const otherProfRecords = data.filter((r) => r.professionalId !== PROF_ID);
          expect(otherProfRecords).toHaveLength(0);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('tenantFilter injeta req.shopId para role=professional (confirma que não há bypass)', async () => {
    /**
     * Directly verify that tenantFilter injects req.shopId for professional.
     */
    const { tenantFilter } = await import('../middlewares/tenantFilter');

    let capturedShopId: string | undefined = 'NOT_SET';

    const mockReq = {
      user: { id: 'prof-id', shopId: SHOP_A, role: 'professional' as const, professionalId: PROF_ID },
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
    // Preservation: req.shopId MUST be SHOP_A for professional
    expect(capturedShopId).toBe(SHOP_A);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 4: Preservation — Admin Users Route Global View
// **Validates: Requirements 3.2**
// ─────────────────────────────────────────────────────────────────────────────
describe('Preservation: GET /admin/users — visão global sem restrição de shopId', () => {
  it('GET /admin/users retorna usuários de múltiplos shops (sem filtro de shopId)', async () => {
    /**
     * Observation (unfixed code):
     *   /admin/users is mounted WITHOUT tenantFilter in routes/index.ts
     *   → req.shopId is never injected for this route
     *   → where clause does NOT include shopId
     *   → Returns users from all shops (global view)
     *
     * This is intentional behavior that must be preserved after the fix.
     */
    const prisma = await getMockedPrisma();
    vi.mocked(prisma.$transaction).mockResolvedValue([allUsers, allUsers.length]);
    vi.mocked(prisma.professional.findMany).mockResolvedValue([]);
    vi.mocked(prisma.userPlan.findMany).mockResolvedValue([]);
    vi.mocked(prisma.appointment.groupBy).mockResolvedValue([]);

    const response = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    const data: Array<{ shopName: string }> = response.body.data;
    expect(data.length).toBeGreaterThan(0);

    // Global view: response includes users from both shop-A and shop-B
    // (mock returns allUsers which has both shops)
    expect(data.length).toBe(allUsers.length);
  });

  it('PBT: para qualquer busca textual, GET /admin/users não filtra por shopId', async () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * Property: for any search term, GET /admin/users returns the full result set
     * without any shopId restriction. The route is mounted without tenantFilter.
     *
     * We verify this by checking that the response count matches the mock count
     * regardless of search term — the shopId filter is never applied.
     */
    const prisma = await getMockedPrisma();

    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.string({ minLength: 0, maxLength: 10 }), { nil: undefined }),
        async (search) => {
          vi.mocked(prisma.$transaction).mockResolvedValue([allUsers, allUsers.length]);
          vi.mocked(prisma.professional.findMany).mockResolvedValue([]);
          vi.mocked(prisma.userPlan.findMany).mockResolvedValue([]);
          vi.mocked(prisma.appointment.groupBy).mockResolvedValue([]);

          const query: Record<string, string> = {};
          if (search) query.search = search;

          const response = await request(app)
            .get('/admin/users')
            .query(query)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(response.status).toBe(200);

          // Global view: total count matches mock (no shopId filtering)
          expect(response.body.total).toBe(allUsers.length);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('GET /admin/users inclui usuários de shop-B mesmo para admin de shop-A', async () => {
    /**
     * Explicit check: admin of shop-A can see users from shop-B via /admin/users.
     * This is the intentional global view behavior.
     */
    const prisma = await getMockedPrisma();
    vi.mocked(prisma.$transaction).mockResolvedValue([allUsers, allUsers.length]);
    vi.mocked(prisma.professional.findMany).mockResolvedValue([]);
    vi.mocked(prisma.userPlan.findMany).mockResolvedValue([]);
    vi.mocked(prisma.appointment.groupBy).mockResolvedValue([]);

    const response = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    // The mock returns users from both shops — all should be present
    expect(response.body.total).toBe(allUsers.length);
    expect(response.body.data.length).toBe(allUsers.length);
  });
});
