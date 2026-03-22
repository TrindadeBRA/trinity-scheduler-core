# Correção de Migração Falhada - Slug da Unit

## Problema

A migração `20260321225645_make_slug_required_and_unique` falhou porque tentou tornar o campo `slug` obrigatório, mas existiam registros com valores `null` no banco de dados.

## Solução Automática (Implementada)

O script de build agora inclui uma verificação automática (`scripts/pre-migrate.js`) que:
1. Detecta migrações falhadas
2. Preenche slugs nulos automaticamente
3. Resolve duplicatas
4. Remove a migração falhada do registro
5. Permite que as migrações prossigam normalmente

**Nenhuma ação manual é necessária!** O próximo deploy corrigirá automaticamente o problema.

## Solução Manual (Se Necessário)

### Opção 1: Script Node.js

Execute o script automatizado:

```bash
cd trinity-scheduler-core
yarn add pg  # Se ainda não instalado
yarn fix:migration
```

### Opção 2: SQL Manual

Se preferir executar manualmente no banco de dados:

```bash
psql $DATABASE_URL -f prisma/fix-migration.sql
```

Ou copie e execute o conteúdo de `prisma/fix-migration.sql` diretamente no seu cliente PostgreSQL.

## Para Produção (Render/Railway/etc)

**Não é necessário fazer nada!** O script `pre-migrate.js` será executado automaticamente durante o build.

Se preferir executar manualmente:
1. Conecte-se ao banco de dados de produção via CLI ou interface web
2. Execute o script SQL de `prisma/fix-migration.sql`
3. Faça o redeploy da aplicação

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

## Como Funciona

O script `pre-migrate.js`:
1. É executado antes de `prisma migrate deploy` no comando `yarn build`
2. Verifica se existem migrações falhadas na tabela `_prisma_migrations`
3. Se encontrar a migração do slug falhada, executa a correção automaticamente
4. Remove o registro da migração falhada
5. Permite que o Prisma aplique a migração novamente (agora com sucesso)
