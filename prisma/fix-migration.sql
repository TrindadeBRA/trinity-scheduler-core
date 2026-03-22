-- Script para resolver migração falhada
-- Execute este script manualmente no banco de dados de produção antes do deploy

-- 1. Remover a entrada da migração falhada
DELETE FROM "_prisma_migrations" 
WHERE "migration_name" = '20260321225645_make_slug_required_and_unique';

-- 2. Preencher slugs nulos com valores gerados a partir do nome
UPDATE "Unit" 
SET "slug" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE("name", '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE "slug" IS NULL;

-- 3. Resolver duplicatas adicionando um sufixo único
WITH duplicates AS (
  SELECT "id", "slug", "shopId",
         ROW_NUMBER() OVER (PARTITION BY "slug" ORDER BY "id") as rn
  FROM "Unit"
)
UPDATE "Unit" u
SET "slug" = d."slug" || '-' || d."shopId"
FROM duplicates d
WHERE u."id" = d."id" AND d.rn > 1;

-- 4. Verificar se ainda existem slugs nulos ou duplicados
SELECT 
  CASE 
    WHEN COUNT(*) FILTER (WHERE "slug" IS NULL) > 0 THEN 'ERRO: Ainda existem slugs nulos'
    WHEN COUNT(*) != COUNT(DISTINCT "slug") THEN 'ERRO: Ainda existem slugs duplicados'
    ELSE 'OK: Pronto para aplicar migração'
  END as status,
  COUNT(*) as total_units,
  COUNT(*) FILTER (WHERE "slug" IS NULL) as null_slugs,
  COUNT(*) - COUNT(DISTINCT "slug") as duplicate_slugs
FROM "Unit";
