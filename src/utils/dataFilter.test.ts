import { describe, it, expect } from 'vitest';
import { applyProfessionalFilter, FilterOptions } from './dataFilter';

describe('dataFilter', () => {
  describe('applyProfessionalFilter', () => {
    it('should add professionalId filter when role is professional', () => {
      const baseWhere = { date: '2025-01-15', unitId: 'unit-123' };
      const options: FilterOptions = {
        role: 'professional',
        professionalId: 'prof-456',
      };

      const result = applyProfessionalFilter(baseWhere, options);

      expect(result).toEqual({
        date: '2025-01-15',
        unitId: 'unit-123',
        professionalId: 'prof-456',
      });
    });

    it('should not add professionalId filter when role is admin', () => {
      const baseWhere = { date: '2025-01-15', unitId: 'unit-123' };
      const options: FilterOptions = {
        role: 'admin',
      };

      const result = applyProfessionalFilter(baseWhere, options);

      expect(result).toEqual({
        date: '2025-01-15',
        unitId: 'unit-123',
      });
    });

    it('should not add professionalId filter when role is leader', () => {
      const baseWhere = { date: '2025-01-15', unitId: 'unit-123' };
      const options: FilterOptions = {
        role: 'leader',
      };

      const result = applyProfessionalFilter(baseWhere, options);

      expect(result).toEqual({
        date: '2025-01-15',
        unitId: 'unit-123',
      });
    });

    it('should not add professionalId filter when professionalId is missing', () => {
      const baseWhere = { date: '2025-01-15', unitId: 'unit-123' };
      const options: FilterOptions = {
        role: 'professional',
      };

      const result = applyProfessionalFilter(baseWhere, options);

      expect(result).toEqual({
        date: '2025-01-15',
        unitId: 'unit-123',
      });
    });

    it('should preserve all existing filters', () => {
      const baseWhere = {
        date: '2025-01-15',
        unitId: 'unit-123',
        shopId: 'shop-789',
        status: 'confirmed',
      };
      const options: FilterOptions = {
        role: 'professional',
        professionalId: 'prof-456',
      };

      const result = applyProfessionalFilter(baseWhere, options);

      expect(result).toEqual({
        date: '2025-01-15',
        unitId: 'unit-123',
        shopId: 'shop-789',
        status: 'confirmed',
        professionalId: 'prof-456',
      });
    });

    it('should work with empty base where clause', () => {
      const baseWhere = {};
      const options: FilterOptions = {
        role: 'professional',
        professionalId: 'prof-456',
      };

      const result = applyProfessionalFilter(baseWhere, options);

      expect(result).toEqual({
        professionalId: 'prof-456',
      });
    });

    it('should not mutate the original baseWhere object', () => {
      const baseWhere = { date: '2025-01-15', unitId: 'unit-123' };
      const options: FilterOptions = {
        role: 'professional',
        professionalId: 'prof-456',
      };

      applyProfessionalFilter(baseWhere, options);

      // Original object should remain unchanged
      expect(baseWhere).toEqual({
        date: '2025-01-15',
        unitId: 'unit-123',
      });
    });
  });
});
