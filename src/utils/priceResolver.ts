/**
 * Resolves the price for a given date based on price rules.
 *
 * @param basePrice - The base price in cents
 * @param priceRules - Array of price rules with dayOfWeek and price
 * @param date - Date string in "YYYY-MM-DD" format
 * @returns The resolved price in cents
 */
export function resolvePriceForDate(
  basePrice: number,
  priceRules: { dayOfWeek: number[]; price: number }[],
  date: string
): number {
  const parsed = new Date(`${date}T00:00:00`);
  const dayOfWeek = parsed.getDay(); // 0=Sunday, 6=Saturday

  const matchingRule = priceRules.find((rule) =>
    rule.dayOfWeek.includes(dayOfWeek)
  );

  return matchingRule ? matchingRule.price : basePrice;
}

/**
 * Computes the min and max price range considering the base price and all rules.
 *
 * @param basePrice - The base price in cents
 * @param priceRules - Array of price rules with price
 * @returns Object with minPrice and maxPrice
 */
export function computePriceRange(
  basePrice: number,
  priceRules: { price: number }[]
): { minPrice: number; maxPrice: number } {
  if (priceRules.length === 0) {
    return { minPrice: basePrice, maxPrice: basePrice };
  }

  const allPrices = [basePrice, ...priceRules.map((r) => r.price)];

  return {
    minPrice: Math.min(...allPrices),
    maxPrice: Math.max(...allPrices),
  };
}

/**
 * Validates an array of price rules.
 *
 * Checks:
 * - Each day in dayOfWeek is an integer in [0, 6]
 * - Each price is an integer > 0
 * - No day appears in more than one rule
 *
 * @param priceRules - Array of price rules to validate
 * @returns Object with valid flag and array of error messages
 */
export function validatePriceRules(
  priceRules: { dayOfWeek: number[]; price: number }[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const seenDays = new Map<number, boolean>();

  for (const rule of priceRules) {
    // Validate days are integers in [0, 6]
    const hasInvalidDay = rule.dayOfWeek.some(
      (d) => !Number.isInteger(d) || d < 0 || d > 6
    );
    if (hasInvalidDay) {
      errors.push(
        "Dias da semana devem ser valores entre 0 (domingo) e 6 (sábado)"
      );
    }

    // Validate price is integer > 0
    if (!Number.isInteger(rule.price) || rule.price <= 0) {
      errors.push("O preço da regra deve ser um valor positivo");
    }

    // Check for duplicate days across rules
    for (const day of rule.dayOfWeek) {
      if (seenDays.has(day)) {
        errors.push(`Dia(s) ${day} já coberto(s) por outra regra de preço`);
      } else {
        seenDays.set(day, true);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
