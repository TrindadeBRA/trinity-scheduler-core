/**
 * Script executado antes das migrações para corrigir migrações falhadas
 * Este script é executado automaticamente durante o build
 */

const { Client } = require('pg');

async function preMigrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔍 Verificando migrações falhadas...\n');

    // Verificar se existe migração falhada
    const failedMigrations = await client.query(`
      SELECT migration_name, started_at, finished_at 
      FROM "_prisma_migrations" 
      WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
    `);

    if (failedMigrations.rows.length === 0) {
      console.log('✅ Nenhuma migração falhada encontrada\n');
      return;
    }

    console.log(`⚠️  Encontradas ${failedMigrations.rows.length} migrações falhadas:`);
    failedMigrations.rows.forEach(row => {
      console.log(`   - ${row.migration_name}`);
    });
    console.log('');

    // Verificar especificamente a migração do slug
    const slugMigration = failedMigrations.rows.find(
      row => row.migration_name === '20260321225645_make_slug_required_and_unique'
    );

    if (slugMigration) {
      console.log('🔧 Corrigindo migração do slug...\n');

      // 1. Preencher slugs nulos
      console.log('1️⃣ Preenchendo slugs nulos...');
      const result1 = await client.query(`
        UPDATE "Unit" 
        SET "slug" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE("name", '[^a-zA-Z0-9\\s-]', '', 'g'), '\\s+', '-', 'g'))
        WHERE "slug" IS NULL
      `);
      console.log(`   ✅ ${result1.rowCount} registros atualizados\n`);

      // 2. Resolver duplicatas
      console.log('2️⃣ Resolvendo duplicatas...');
      await client.query(`
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
      console.log('   ✅ Duplicatas resolvidas\n');

      // 3. Verificar resultado
      console.log('3️⃣ Verificando resultado...');
      const verification = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE "slug" IS NULL) as nulls,
          COUNT(DISTINCT "slug") as unique_slugs
        FROM "Unit"
      `);
      
      const stats = verification.rows[0];
      console.log(`   📊 Total: ${stats.total}, Nulos: ${stats.nulls}, Únicos: ${stats.unique_slugs}\n`);

      if (parseInt(stats.nulls) > 0) {
        throw new Error('Ainda existem slugs nulos após correção');
      }

      // 4. Remover a migração falhada
      console.log('4️⃣ Removendo migração falhada do registro...');
      await client.query(`
        DELETE FROM "_prisma_migrations" 
        WHERE "migration_name" = '20260321225645_make_slug_required_and_unique'
      `);
      console.log('   ✅ Migração removida\n');

      console.log('✅ Correção concluída! As migrações podem prosseguir.\n');
    } else {
      // Outras migrações falhadas
      console.log('⚠️  Migrações falhadas detectadas, mas não são a do slug.');
      console.log('   Removendo registros de migrações falhadas...\n');
      
      for (const migration of failedMigrations.rows) {
        await client.query(`
          DELETE FROM "_prisma_migrations" 
          WHERE "migration_name" = $1
        `, [migration.migration_name]);
        console.log(`   ✅ Removida: ${migration.migration_name}`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Erro durante pré-migração:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

preMigrate();
