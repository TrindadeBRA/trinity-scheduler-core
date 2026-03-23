/**
 * Bug Condition Exploration Tests — Forgot/Reset Password Flow
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 *
 * CRITICAL: These tests MUST FAIL on the unfixed code.
 * Failure confirms the bug exists. DO NOT fix the code when tests fail.
 *
 * isBugCondition:
 *   Caso 1: action='forgot-password' AND userExistsWithEmail(email) AND NOT emailWasSent(email)
 *   Caso 2: action='reset-password' AND NOT endpointExists('/admin/auth/reset-password')
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../../app';
import { prisma } from '../../../utils/prisma';

// ─── Mock email module at module level ───────────────────────────────────────
// sendPasswordResetEmail does not exist yet — we mock the entire module so the
// spy can be injected once the function is added in the fix.
vi.mock('../../../utils/email', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/email')>();
  return {
    ...actual,
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  };
});

// ─── Test data ────────────────────────────────────────────────────────────────
const TEST_EMAIL = 'bugcondition-test@example.com';
const TEST_PASSWORD = 'Senha@123';

describe('Bug Condition Exploration — Forgot/Reset Password Flow', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Clear any existing test user
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

    // Create a shop and user for testing
    const shop = await prisma.shop.create({
      data: { name: 'Bug Condition Test Shop' },
    });

    const { hashPassword } = await import('../../../utils/password');
    const passwordHash = await hashPassword(TEST_PASSWORD);

    const user = await prisma.user.create({
      data: {
        shopId: shop.id,
        name: 'Bug Condition User',
        email: TEST_EMAIL,
        passwordHash,
        role: 'leader',
      },
    });

    testUserId = user.id;
  });

  afterEach(async () => {
    // Cleanup test data
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.shop.deleteMany({ where: { name: 'Bug Condition Test Shop' } });
    vi.clearAllMocks();
  });

  // ─── Caso 1: Email não enviado ──────────────────────────────────────────────
  describe('Caso 1 — Email não enviado no forgot-password', () => {
    it('deve chamar sendPasswordResetEmail quando o email está cadastrado', async () => {
      /**
       * isBugCondition: action='forgot-password' AND userExistsWithEmail(email) AND NOT emailWasSent(email)
       *
       * Expected counterexample (unfixed code):
       *   sendPasswordResetEmail is NEVER invoked in the handler.
       *   This test FAILS on unfixed code — confirming the bug.
       */
      const { sendPasswordResetEmail } = await import('../../../utils/email');
      const spy = vi.mocked(sendPasswordResetEmail);

      const response = await request(app)
        .post('/admin/auth/forgot-password')
        .send({ email: TEST_EMAIL });

      // The endpoint should return 200 (already works)
      expect(response.status).toBe(200);

      // BUG CONDITION: sendPasswordResetEmail should have been called
      // On unfixed code this assertion FAILS — confirming the bug exists
      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        TEST_EMAIL,
        expect.objectContaining({
          name: expect.any(String),
          resetUrl: expect.stringContaining('reset-password?token='),
        })
      );
    });
  });

  // ─── Caso 2: Endpoint reset-password inexistente ────────────────────────────
  describe('Caso 2 — Endpoint reset-password inexistente', () => {
    it('deve retornar 200 ao fazer POST /admin/auth/reset-password com token válido', async () => {
      /**
       * isBugCondition: action='reset-password' AND NOT endpointExists('/admin/auth/reset-password')
       *
       * Expected counterexample (unfixed code):
       *   POST /admin/auth/reset-password returns 404 Not Found.
       *   This test FAILS on unfixed code — confirming the endpoint does not exist.
       */

      // First, set a reset token directly in the DB to simulate a valid token
      const resetToken = 'valid-test-token-12345';
      const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      await prisma.user.update({
        where: { id: testUserId },
        data: { resetToken, resetTokenExp },
      });

      const response = await request(app)
        .post('/admin/auth/reset-password')
        .send({ token: resetToken, password: 'NovaSenha@456' });

      // BUG CONDITION: endpoint should return 200
      // On unfixed code this assertion FAILS (returns 401/404) — confirming the endpoint doesn't exist
      // Note: returns 401 because the route doesn't exist and falls through to authMiddleware
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: expect.stringContaining('sucesso'),
      });
    });
  });
});
