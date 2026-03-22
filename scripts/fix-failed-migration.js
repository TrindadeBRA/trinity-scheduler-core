/**
 * Script para resolver migração falhada do slug
 * Execute: node scripts/fix-failed-migration.js
 */

const { PrismaClient } = require('@prisma/client');

async function fixFailedMigration() {
  const prisma = new PrismaClient();

  try {
    console.log('🔧 Iniciando correção da migração falhada...\n');

    // 1. Remover a migração falhada da tabela de controle
    console.log('1️⃣ Removendo entrada da migração falhada...');
    await prisma.$executeRawUnsafe(`
      DELETE FROM "_prisma_migrations" 
      WHERE "migration_name" = '20260321225645_make_slug_required_and_unique'
    `);
    console.log('✅ Migração falhada removida\n');

    // 2. Preencher slugs nulos
    console.log('2️⃣ Preenchendo slugs nulos...');
    const updatedNulls = await prisma.$executeRawUnsafe(`
      UPDATE "Unit" 
      SET "slug" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE("name", '[^a-zA-Z0-9\\s-]', '', 'g'), '\\s+', '-', 'g'))
      WHERE "slug" IS NULL
    `);
    console.log(`✅ ${updatedNulls} unidades atualizadas\n`);

    // 3. Resolver duplicatas
    console.log('3️⃣ Resolvendo slugs duplicados...');
    await prisma.$executeRawUnsafe(`
      WITH duplicates AS (
        SELECT "id", "slug", "shopId",
               ROW_NUMBER() OVER (PARTITION BY "slug" ORDER BY "id") as rn
        FROM "Unit"
      )
      UPDATE "Unit" u
      SET "slug" = d."slug" || '-' || d."shopId"
      FROM duplicates d
      WHERE u."id" = d."id" AND d.rn > 1
    `);
    console.log('✅ Duplicatas resolvidas\n');

    // 4. Verificar resultado
    console.log('4️⃣ Verificando resultado...');
    const units = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) as total_units,
        COUNT(*) FILTER (WHERE "slug" IS NULL) as null_slugs,
        COUNT(DISTINCT "slug") as unique_slugs
      FROM "Unit"
    `);
    
    const result = units[0];
    console.log(`📊 Total de unidades: ${result.total_units}`);
    console.log(`📊 Slugs nulos: ${result.null_slugs}`);
    console.log(`📊 Slugs únicos: ${result.unique_slugs}`);

    if (result.null_slugs > 0) {
      console.log('\n❌ ERRO: Ainda existem slugs nulos!');
      process.exit(1);
    }

    if (result.total_units !== result.unique_slugs) {
      console.log('\n❌ ERRO: Ainda existem slugs duplicados!');
      process.exit(1);
    }

    console.log('\n✅ Correção concluída com sucesso!');
    console.log('🚀 Agora você pode executar: yarn prisma:migrate\n');

  } catch (error) {
    console.error('❌ Erro ao corrigir migração:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixFailedMigration();
