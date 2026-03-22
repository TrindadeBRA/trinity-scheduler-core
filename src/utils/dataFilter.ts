/**
 * Data Filter Utility for Role-Based Access Control
 * 
 * This utility provides functions to apply role-based filters to database queries,
 * ensuring that users only access data they are authorized to see.
 */

/**
 * Filter options for role-based data filtering
 */
export interface FilterOptions {
  role: 'admin' | 'leader' | 'professional';
  shopId?: string;
  professionalId?: string;
}

/**
 * Appointment filter structure for Prisma queries
 */
export interface AppointmentFilter {
  shopId?: string;
  professionalId?: string;
  [key: string]: unknown;
}

/**
 * Apply professional filter to a base where clause
 * 
 * When the role is 'professional' and a professionalId is provided,
 * this function adds the professionalId filter to the where clause.
 * All existing filters in the base where clause are preserved.
 * 
 * @param baseWhere - The base where clause object (may contain existing filters like date, unitId, etc.)
 * @param options - Filter options containing role, shopId, and professionalId
 * @returns Modified where clause with professional filter applied if needed
 * 
 * @example
 * // For a professional user
 * const where = applyProfessionalFilter(
 *   { date: '2025-01-15', unitId: 'unit-123' },
 *   { role: 'professional', professionalId: 'prof-456' }
 * );
 * // Result: { date: '2025-01-15', unitId: 'unit-123', professionalId: 'prof-456' }
 * 
 * @example
 * // For an admin or leader user
 * const where = applyProfessionalFilter(
 *   { date: '2025-01-15', unitId: 'unit-123' },
 *   { role: 'admin' }
 * );
 * // Result: { date: '2025-01-15', unitId: 'unit-123' }
 */
export function applyProfessionalFilter(
  baseWhere: Record<string, unknown>,
  options: FilterOptions
): Record<string, unknown> {
  // Create a copy of the base where clause to avoid mutation
  const where = { ...baseWhere };

  // Apply professional filter only if role is 'professional' and professionalId exists
  if (options.role === 'professional' && options.professionalId) {
    where.professionalId = options.professionalId;
  }

  return where;
}
