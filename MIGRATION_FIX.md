# Correção de Migração Falhada - Slug da Unit

## Problema

A migração `20260321225645_make_slug_required_and_unique` falhou porque tentou tornar o campo `slug` obrigatório, mas existiam registros com valores `null` no banco de dados.

## Solução

### Opção 1: Script Node.js (Recomendado)

Execute o script automatizado:

```bash
cd trinity-scheduler-core
node scripts/fix-failed-migration.js
```

Este script irá:
1. Remover a entrada da migração falhada
2. Preencher todos os slugs nulos com valores gerados a partir do nome
3. Resolver slugs duplicados adicionando o shopId
4. Verificar se tudo está correto

Após executar o script, rode as migrações normalmente:

```bash
yarn prisma:migrate
```

### Opção 2: SQL Manual

Se preferir executar manualmente no banco de dados:

```bash
psql $DATABASE_URL -f prisma/fix-migration.sql
```

Ou copie e execute o conteúdo de `prisma/fix-migration.sql` diretamente no seu cliente PostgreSQL.

## Para Produção (Render/Railway/etc)

1. Conecte-se ao banco de dados de produção via CLI ou interface web
2. Execute o script SQL de `prisma/fix-migration.sql`
3. Faça o redeploy da aplicação

## Prevenção

A migração foi corrigida para incluir os passos de preenchimento de dados antes de tornar o campo obrigatório. Novos deploys não terão este problema.

## Verificação

Após a correção, você pode verificar se está tudo ok:

```sql
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE slug IS NULL) as nulls,
  COUNT(DISTINCT slug) as unique_slugs
FROM "Unit";
```

O resultado deve mostrar:
- `nulls` = 0
- `total` = `unique_slugs`
