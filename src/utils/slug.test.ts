import { describe, it, expect } from 'vitest';
import { sanitizeSlug, validateSlug, generateSlug, suggestAlternativeSlugs } from './slug';

describe('Slug Utilities', () => {
  describe('sanitizeSlug', () => {
    it('should convert to lowercase', () => {
      expect(sanitizeSlug('Trinity Barber')).toBe('trinity-barber');
    });

    it('should remove accents', () => {
      expect(sanitizeSlug('Salão São José')).toBe('salao-sao-jose');
    });

    it('should replace spaces with hyphens', () => {
      expect(sanitizeSlug('My Unit Name')).toBe('my-unit-name');
    });

    it('should remove special characters', () => {
      expect(sanitizeSlug('Unit@123#Test!')).toBe('unit-123-test');
    });

    it('should normalize multiple hyphens', () => {
      expect(sanitizeSlug('unit---test')).toBe('unit-test');
    });

    it('should remove leading and trailing hyphens', () => {
      expect(sanitizeSlug('-unit-test-')).toBe('unit-test');
    });
  });

  describe('validateSlug', () => {
    it('should accept valid slugs', () => {
      expect(validateSlug('trinity-barber').valid).toBe(true);
      expect(validateSlug('unit123').valid).toBe(true);
      expect(validateSlug('abc').valid).toBe(true);
    });

    it('should reject slugs shorter than 3 characters', () => {
      const result = validateSlug('ab');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mínimo 3 caracteres');
    });

    it('should reject slugs longer than 63 characters', () => {
      const longSlug = 'a'.repeat(64);
      const result = validateSlug(longSlug);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('máximo 63 caracteres');
    });

    it('should reject slugs starting with hyphen', () => {
      const result = validateSlug('-unit');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('iniciar com letra ou número');
    });

    it('should reject slugs ending with hyphen', () => {
      const result = validateSlug('unit-');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('terminar com letra ou número');
    });

    it('should reject slugs with invalid characters', () => {
      const result = validateSlug('unit@test');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('letras minúsculas');
    });
  });

  describe('generateSlug', () => {
    it('should generate valid slug from unit name', () => {
      const slug = generateSlug('Trinity Barber Shop');
      expect(slug).toBe('trinity-barber-shop');
      expect(validateSlug(slug).valid).toBe(true);
    });

    it('should handle names with accents', () => {
      const slug = generateSlug('Barbearia São Paulo');
      expect(slug).toBe('barbearia-sao-paulo');
      expect(validateSlug(slug).valid).toBe(true);
    });

    it('should handle empty or very short names', () => {
      const slug = generateSlug('');
      expect(slug).toMatch(/^unit-[a-z0-9]+$/);
      expect(validateSlug(slug).valid).toBe(true);
    });

    it('should truncate long names to 63 characters', () => {
      const longName = 'A'.repeat(100);
      const slug = generateSlug(longName);
      expect(slug.length).toBeLessThanOrEqual(63);
      expect(validateSlug(slug).valid).toBe(true);
    });
  });

  describe('suggestAlternativeSlugs', () => {
    it('should suggest slug with -2 suffix if base exists', () => {
      const suggestion = suggestAlternativeSlugs('trinity', ['trinity']);
      expect(suggestion).toBe('trinity-2');
    });

    it('should increment suffix until finding available slug', () => {
      const suggestion = suggestAlternativeSlugs('trinity', ['trinity', 'trinity-2', 'trinity-3']);
      expect(suggestion).toBe('trinity-4');
    });

    it('should return -2 suffix if no conflicts', () => {
      const suggestion = suggestAlternativeSlugs('trinity', []);
      expect(suggestion).toBe('trinity-2');
    });
  });
});
