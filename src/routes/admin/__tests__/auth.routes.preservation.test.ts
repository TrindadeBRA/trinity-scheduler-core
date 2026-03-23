/**
 * Preservation Property Tests — Auth Routes
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * Property 2: Preservation — Comportamentos existentes não afetados pelo fix
 *
 * These tests capture the CURRENT behavior of auth routes on the UNFIXED code.
 * They MUST PASS before and after the fix.
 *
 * isBugCondition returns FALSE for all inputs tested here.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import request from 'supertest';
import app from '../../../app';
import { prisma } from '../../../utils/prisma';
import { hashPassword } from '../../../utils/password';

// ─── Test data ────────────────────────────────────────────────────────────────
const TEST_EMAIL = 'preservation-test@example.com';
const TEST_PASSWORD = 'Senha@123';

describe('Preservation Tests — Auth Routes (MUST PASS on unfixed code)', () => {
  let testUserId: string;

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

    const shop = await prisma.shop.create({
      data: { name: 'Preservation Test Shop' },
    });

    const passwordHash = await hashPassword(TEST_PASSWORD);

    const user = await prisma.user.create({
      data: {
        shopId: shop.id,
        name: 'Preservation User',
        email: TEST_EMAIL,
        passwordHash,
        role: 'leader',
      },
    });

    testUserId = user.id;
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.shop.deleteMany({ where: { name: 'Preservation Test Shop' } });
  });

  // ─── Property 2a — Idempotência do forgot-password (P3) ──────────────────────
  describe('Property 2a — Idempotência do forgot-password (P3)', () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * For any email (registered or not), POST /admin/auth/forgot-password
     * always returns HTTP 200 with a generic message that does not leak info.
     *
     * isBugCondition returns FALSE here because we are testing the non-leaking
     * behavior (email not registered, or multiple calls with same email).
     */
    it('PBT: sempre retorna 200 com mensagem genérica para qualquer email', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          async (email) => {
            const response = await request(app)
              .post('/admin/auth/forgot-password')
              .send({ email });

            // Must always return 200 regardless of whether email is registered
            expect(response.status).toBe(200);

            // Message must be present and not leak info about email existence
            expect(response.body).toHaveProperty('message');
            expect(typeof response.body.message).toBe('string');
            expect(response.body.message.length).toBeGreaterThan(0);

            // Must NOT contain the email in the response (no info leakage)
            expect(response.body.message).not.toContain(email);
          }
        ),
        { numRuns: 3 }
      );
    });

    it('múltiplas chamadas com o mesmo email retornam 200 todas as vezes', async () => {
      // Call 3 times with the registered email — all must return 200
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/admin/auth/forgot-password')
          .send({ email: TEST_EMAIL });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message');
      }
    });

    it('email não cadastrado retorna 200 com mensagem genérica', async () => {
      const response = await request(app)
        .post('/admin/auth/forgot-password')
        .send({ email: 'nao-cadastrado@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });
  });

  // ─── Property 2b — Login preservado ──────────────────────────────────────────
  describe('Property 2b — Login preservado', () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * For a valid email/password pair, POST /admin/auth/login returns JWT.
     * This behavior must not be broken by the fix.
     */
    it('login com credenciais válidas retorna JWT', async () => {
      const response = await request(app)
        .post('/admin/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(TEST_EMAIL);
    });

    /**
     * **Validates: Requirements 3.3**
     *
     * Login with invalid credentials must continue returning 401.
     */
    it('login com senha inválida retorna 401', async () => {
      const response = await request(app)
        .post('/admin/auth/login')
        .send({ email: TEST_EMAIL, password: 'SenhaErrada@999' });

      expect(response.status).toBe(401);
    });

    it('login com email não cadastrado retorna 401', async () => {
      const response = await request(app)
        .post('/admin/auth/login')
        .send({ email: 'nao-existe@example.com', password: TEST_PASSWORD });

      expect(response.status).toBe(401);
    });
  });

  // ─── Property 2c — Rejeição de token expirado (P5) ───────────────────────────
  describe('Property 2c — Rejeição de token expirado (P5)', () => {
    /**
     * **Validates: Requirements 3.4**
     */
    it('PBT: para qualquer resetTokenExp no passado, POST /admin/auth/reset-password retorna 400', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2000-01-01T00:00:00.000Z'), max: new Date(Date.now() - 1000) }),
          async (expiredDate) => {
            const resetToken = `expired-token-${Date.now()}-${Math.random()}`;
            await prisma.user.update({
              where: { id: testUserId },
              data: { resetToken, resetTokenExp: expiredDate },
            });

            const response = await request(app)
              .post('/admin/auth/reset-password')
              .send({ token: resetToken, password: 'NovaSenha@456' });

            expect(response.status).toBe(400);
          }
        ),
        { numRuns: 3 }
      );
    });
  });

  // ─── Property 2d — Rejeição de senha fraca (P6) ──────────────────────────────
  describe('Property 2d — Rejeição de senha fraca (P6)', () => {
    /**
     * **Validates: Requirements 3.5**
     */
    it('senha sem maiúscula é rejeitada com HTTP 400', async () => {
      const resetToken = 'weak-pass-test-token';
      await prisma.user.update({
        where: { id: testUserId },
        data: { resetToken, resetTokenExp: new Date(Date.now() + 3600_000) },
      });

      const response = await request(app)
        .post('/admin/auth/reset-password')
        .send({ token: resetToken, password: 'semmaius@123' });

      expect(response.status).toBe(400);
    });

    it('senha sem caractere especial é rejeitada com HTTP 400', async () => {
      const resetToken = 'weak-pass-test-token2';
      await prisma.user.update({
        where: { id: testUserId },
        data: { resetToken, resetTokenExp: new Date(Date.now() + 3600_000) },
      });

      const response = await request(app)
        .post('/admin/auth/reset-password')
        .send({ token: resetToken, password: 'SemEspecial123' });

      expect(response.status).toBe(400);
    });
  });
});
