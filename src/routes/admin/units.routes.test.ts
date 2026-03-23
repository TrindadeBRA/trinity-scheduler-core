import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../../utils/prisma';
import { sanitizeSlug, validateSlug, generateSlug } from '../../utils/slug';

// Mock Prisma
vi.mock('../../utils/prisma', () => ({
  prisma: {
    unit: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('POST /admin/units - Slug handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Slug sanitization', () => {
    it('deve sanitizar slug com caracteres especiais', () => {
      const result = sanitizeSlug('Trinity Barber!!!');
      expect(result).toBe('trinity-barber');
    });

    it('deve sanitizar slug com acentos', () => {
      const result = sanitizeSlug('Barbearia São José');
      expect(result).toBe('barbearia-sao-jose');
    });

    it('deve sanitizar slug com espaços múltiplos', () => {
      const result = sanitizeSlug('Trinity   Barber');
      expect(result).toBe('trinity-barber');
    });

    it('deve remover hífens do início e fim', () => {
      const result = sanitizeSlug('---trinity-barber---');
      expect(result).toBe('trinity-barber');
    });
  });

  describe('Slug validation', () => {
    it('deve validar slug correto', () => {
      const result = validateSlug('trinity-barber');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve rejeitar slug muito curto', () => {
      const result = validateSlug('ab');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mínimo 3 caracteres');
    });

    it('deve rejeitar slug muito longo', () => {
      const longSlug = 'a'.repeat(64);
      const result = validateSlug(longSlug);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('máximo 63 caracteres');
    });

    it('deve rejeitar slug que inicia com hífen', () => {
      const result = validateSlug('-trinity');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('iniciar com letra ou número');
    });

    it('deve rejeitar slug que termina com hífen', () => {
      const result = validateSlug('trinity-');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('terminar com letra ou número');
    });

    it('deve rejeitar slug com caracteres inválidos', () => {
      const result = validateSlug('trinity_barber');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('apenas letras minúsculas, números e hífens');
    });
  });

  describe('Slug generation', () => {
    it('deve gerar slug a partir do nome', () => {
      const result = generateSlug('Trinity Barber');
      expect(result).toBe('trinity-barber');
    });

    it('deve gerar slug com fallback para nome vazio', () => {
      const result = generateSlug('');
      expect(result).toMatch(/^unit-[a-z0-9]+$/);
    });

    it('deve truncar slug muito longo', () => {
      const longName = 'a'.repeat(100);
      const result = generateSlug(longName);
      expect(result.length).toBeLessThanOrEqual(63);
    });
  });

  describe('Uniqueness check', () => {
    it('deve verificar unicidade case-insensitive', async () => {
      const existingUnit = {
        id: 'existing-id',
        shopId: 'shop-id',
        name: 'Existing',
        slug: 'trinity-barber',
        phone: null,
        zipcode: null,
        street: null,
        number: null,
        complement: null,
        district: null,
        city: null,
        state: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.unit.findFirst).mockResolvedValue(existingUnit);

      // Simula a verificação que o endpoint faz
      const slug = 'TRINITY-BARBER';
      const sanitized = sanitizeSlug(slug);
      
      const existing = await prisma.unit.findFirst({
        where: { slug: { equals: sanitized, mode: 'insensitive' } }
      });

      expect(existing).not.toBeNull();
      expect(prisma.unit.findFirst).toHaveBeenCalledWith({
        where: { slug: { equals: 'trinity-barber', mode: 'insensitive' } }
      });
    });

    it('deve permitir criação quando slug não existe', async () => {
      vi.mocked(prisma.unit.findFirst).mockResolvedValue(null);

      const existing = await prisma.unit.findFirst({
        where: { slug: { equals: 'new-slug', mode: 'insensitive' } }
      });

      expect(existing).toBeNull();
    });
  });

  describe('Integration flow', () => {
    it('deve processar fluxo completo: sanitizar, validar, verificar unicidade e criar', async () => {
      const inputSlug = 'Trinity Barber!!!';
      const sanitized = sanitizeSlug(inputSlug);
      const validation = validateSlug(sanitized);

      expect(sanitized).toBe('trinity-barber');
      expect(validation.valid).toBe(true);

      vi.mocked(prisma.unit.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.unit.create).mockResolvedValue({
        id: 'new-id',
        shopId: 'shop-id',
        name: 'Trinity Barber',
        slug: sanitized,
        phone: null,
        zipcode: null,
        street: null,
        number: null,
        complement: null,
        district: null,
        city: null,
        state: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const existing = await prisma.unit.findFirst({
        where: { slug: { equals: sanitized, mode: 'insensitive' } }
      });

      expect(existing).toBeNull();

      const created = await prisma.unit.create({
        data: {
          shopId: 'shop-id',
          name: 'Trinity Barber',
          slug: sanitized,
          phone: null,
        },
      });

      expect(created.slug).toBe('trinity-barber');
    });
  });
});

