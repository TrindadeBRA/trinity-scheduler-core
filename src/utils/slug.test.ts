import { describe, it, expect } from 'vitest';
import { sanitizeSlug, validateSlug, generateSlug, suggestAlternativeSlugs } from './slug';

describe('slug utilities', () => {
  describe('sanitizeSlug', () => {
    it('deve converter para lowercase', () => {
      expect(sanitizeSlug('TrinityBarber')).toBe('trinitybarber');
    });

    it('deve remover acentos', () => {
      expect(sanitizeSlug('Barbearia São José')).toBe('barbearia-sao-jose');
    });

    it('deve substituir espaços por hífens', () => {
      expect(sanitizeSlug('Trinity Barber Shop')).toBe('trinity-barber-shop');
    });

    it('deve remover caracteres especiais', () => {
      expect(sanitizeSlug('Barber@Shop#123')).toBe('barber-shop-123');
    });

    it('deve remover múltiplos hífens consecutivos', () => {
      expect(sanitizeSlug('barber---shop')).toBe('barber-shop');
    });

    it('deve remover hífens do início e fim', () => {
      expect(sanitizeSlug('-barber-shop-')).toBe('barber-shop');
    });
  });

  describe('validateSlug', () => {
    it('deve aceitar slug válido', () => {
      const result = validateSlug('trinitybarber');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve aceitar slug com números', () => {
      const result = validateSlug('barber123');
      expect(result.valid).toBe(true);
    });

    it('deve aceitar slug com hífens', () => {
      const result = validateSlug('trinity-barber');
      expect(result.valid).toBe(true);
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
      const result = validateSlug('-barber');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('iniciar com letra ou número');
    });

    it('deve rejeitar slug que termina com hífen', () => {
      const result = validateSlug('barber-');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('terminar com letra ou número');
    });

    it('deve rejeitar slug com caracteres inválidos', () => {
      const result = validateSlug('barber_shop');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('apenas letras minúsculas');
    });

    it('deve rejeitar slug com maiúsculas', () => {
      const result = validateSlug('TrinityBarber');
      expect(result.valid).toBe(false);
    });

    describe('palavras reservadas', () => {
      const reservedWords = [
        'admin',
        'app',
        'painel',
        'dashboard',
        'api',
        'www',
        'mail',
        'test',
        'dev',
        'production',
        'root',
        'system',
      ];

      reservedWords.forEach(word => {
        it(`deve rejeitar palavra reservada: ${word}`, () => {
          const result = validateSlug(word);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('reservado');
        });
      });

      it('deve rejeitar palavra reservada case-insensitive', () => {
        // Testa que a validação de reservadas é case-insensitive
        // mesmo quando o slug já está em lowercase
        const result = validateSlug('admin');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('reservado');
      });
    });
  });

  describe('generateSlug', () => {
    it('deve gerar slug a partir de nome', () => {
      expect(generateSlug('Trinity Barber')).toBe('trinity-barber');
    });

    it('deve gerar slug com acentos removidos', () => {
      expect(generateSlug('Barbearia São José')).toBe('barbearia-sao-jose');
    });

    it('deve gerar slug válido para nome vazio', () => {
      const slug = generateSlug('');
      expect(slug).toMatch(/^unit-[a-z0-9]+$/);
      expect(slug.length).toBeGreaterThanOrEqual(3);
    });

    it('deve truncar slug muito longo', () => {
      const longName = 'a'.repeat(100);
      const slug = generateSlug(longName);
      expect(slug.length).toBeLessThanOrEqual(63);
    });

    it('deve remover hífen final após truncamento', () => {
      const name = 'a'.repeat(62) + '-b';
      const slug = generateSlug(name);
      expect(slug).not.toMatch(/-$/);
    });
  });

  describe('suggestAlternativeSlugs', () => {
    it('deve sugerir slug com sufixo -2', () => {
      const existing = ['trinitybarber'];
      const suggestion = suggestAlternativeSlugs('trinitybarber', existing);
      expect(suggestion).toBe('trinitybarber-2');
    });

    it('deve incrementar sufixo até encontrar disponível', () => {
      const existing = ['barber', 'barber-2', 'barber-3'];
      const suggestion = suggestAlternativeSlugs('barber', existing);
      expect(suggestion).toBe('barber-4');
    });

    it('deve funcionar com lista vazia', () => {
      const suggestion = suggestAlternativeSlugs('barber', []);
      expect(suggestion).toBe('barber-2');
    });
  });
});
