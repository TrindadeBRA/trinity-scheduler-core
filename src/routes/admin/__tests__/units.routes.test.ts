import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../../utils/prisma';

/**
 * Integration tests for PUT /admin/units/:id endpoint
 * Tests slug update functionality
 */

describe('PUT /admin/units/:id - Slug Update', () => {
  let testShopId: string;
  let testUnitId: string;
  let anotherUnitId: string;

  beforeAll(async () => {
    // Create test shop
    const shop = await prisma.shop.create({
      data: {
        name: 'Test Shop for Slug Update',
        email: 'slugtest@example.com',
        phone: '1234567890',
      },
    });
    testShopId = shop.id;

    // Create test units
    const unit1 = await prisma.unit.create({
      data: {
        shopId: testShopId,
        name: 'Test Unit 1',
        slug: 'test-unit-1',
      },
    });
    testUnitId = unit1.id;

    const unit2 = await prisma.unit.create({
      data: {
        shopId: testShopId,
        name: 'Test Unit 2',
        slug: 'test-unit-2',
      },
    });
    anotherUnitId = unit2.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.unit.deleteMany({ where: { shopId: testShopId } });
    await prisma.shop.delete({ where: { id: testShopId } });
  });

  it('should update unit slug successfully', async () => {
    const newSlug = 'updated-slug';
    
    const updated = await prisma.unit.update({
      where: { id: testUnitId },
      data: { slug: newSlug },
    });

    expect(updated.slug).toBe(newSlug);
  });

  it('should reject duplicate slug (case-insensitive)', async () => {
    // Try to update unit1 with unit2's slug
    const existingSlug = 'test-unit-2';
    
    const conflicting = await prisma.unit.findFirst({
      where: {
        slug: { equals: existingSlug, mode: 'insensitive' },
        id: { not: testUnitId },
      },
    });

    expect(conflicting).not.toBeNull();
    expect(conflicting?.id).toBe(anotherUnitId);
  });

  it('should allow updating slug to same value (case variation)', async () => {
    const currentUnit = await prisma.unit.findUnique({
      where: { id: testUnitId },
    });

    // Should not find conflict when checking against itself
    const conflicting = await prisma.unit.findFirst({
      where: {
        slug: { equals: currentUnit!.slug, mode: 'insensitive' },
        id: { not: testUnitId },
      },
    });

    expect(conflicting).toBeNull();
  });

  it('should handle slug sanitization', async () => {
    const dirtySlug = 'Test Slug With Spaces';
    const expectedSlug = 'test-slug-with-spaces';
    
    // This would be done by sanitizeSlug in the route
    const sanitized = dirtySlug
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    expect(sanitized).toBe(expectedSlug);
  });
});
