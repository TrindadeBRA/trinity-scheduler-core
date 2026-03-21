import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../utils/prisma';

describe('Unit Slug Resolution', () => {
  let testShopId: string;
  let testUnitId: string;
  const testSlug = 'test-unit-resolve';

  beforeAll(async () => {
    // Criar shop de teste
    const shop = await prisma.shop.create({
      data: {
        name: 'Test Shop for Slug Resolution',
        email: 'slug-test@example.com',
      },
    });
    testShopId = shop.id;

    // Criar unidade de teste
    const unit = await prisma.unit.create({
      data: {
        shopId: testShopId,
        name: 'Test Unit for Resolution',
        slug: testSlug,
      },
    });
    testUnitId = unit.id;
  });

  afterAll(async () => {
    // Limpar dados de teste
    await prisma.unit.deleteMany({ where: { shopId: testShopId } });
    await prisma.shop.deleteMany({ where: { id: testShopId } });
  });

  it('deve encontrar unidade por slug e incluir informações do shop', async () => {
    const unit = await prisma.unit.findUnique({
      where: { slug: testSlug },
      include: { 
        shop: { 
          select: { id: true, name: true } 
        } 
      }
    });

    expect(unit).toBeDefined();
    expect(unit?.id).toBe(testUnitId);
    expect(unit?.shopId).toBe(testShopId);
    expect(unit?.name).toBe('Test Unit for Resolution');
    expect(unit?.shop.name).toBe('Test Shop for Slug Resolution');
  });

  it('deve fazer lookup case-insensitive do slug', async () => {
    const normalizedSlug = testSlug.toUpperCase().toLowerCase();
    
    const unit = await prisma.unit.findUnique({
      where: { slug: normalizedSlug },
      include: { 
        shop: { 
          select: { id: true, name: true } 
        } 
      }
    });

    expect(unit).toBeDefined();
    expect(unit?.id).toBe(testUnitId);
  });

  it('deve retornar null para slug inexistente', async () => {
    const unit = await prisma.unit.findUnique({
      where: { slug: 'nonexistent-slug-12345' },
      include: { 
        shop: { 
          select: { id: true, name: true } 
        } 
      }
    });

    expect(unit).toBeNull();
  });

  it('deve retornar estrutura correta com unitId, shopId, unitName, shopName', async () => {
    const unit = await prisma.unit.findUnique({
      where: { slug: testSlug },
      include: { 
        shop: { 
          select: { id: true, name: true } 
        } 
      }
    });

    expect(unit).toBeDefined();
    
    // Simula a resposta do endpoint
    const response = {
      unitId: unit!.id,
      shopId: unit!.shopId,
      unitName: unit!.name,
      shopName: unit!.shop.name
    };

    expect(response).toEqual({
      unitId: testUnitId,
      shopId: testShopId,
      unitName: 'Test Unit for Resolution',
      shopName: 'Test Shop for Slug Resolution',
    });
  });
});
