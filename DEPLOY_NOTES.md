# Deploy Notes - Correção Automática de Migração

## Mudanças Implementadas

### 1. Script de Pré-Migração Automático
- **Arquivo**: `scripts/pre-migrate.js`
- **Função**: Detecta e corrige migrações falhadas automaticamente antes do deploy
- **Execução**: Automática durante `yarn build`

### 2. Dependência Adicionada
- **Pacote**: `pg@^8.13.1`
- **Motivo**: Necessário para o script de pré-migração se conectar ao PostgreSQL

### 3. Script de Build Atualizado
- **Antes**: `prisma generate && prisma migrate deploy && tsc`
- **Depois**: `node scripts/pre-migrate.js && prisma generate && prisma migrate deploy && tsc`

## O Que Acontece no Próximo Deploy

1. O Render/Railway executa `yarn build`
2. O script `pre-migrate.js` é executado primeiro
3. Ele detecta a migração falhada `20260321225645_make_slug_required_and_unique`
4. Preenche automaticamente os slugs nulos
5. Resolve duplicatas
6. Remove o registro da migração falhada
7. O Prisma aplica a migração novamente (agora com sucesso)
8. O build continua normalmente

## Nenhuma Ação Manual Necessária

O problema será resolvido automaticamente no próximo deploy. Não é necessário:
- Conectar manualmente ao banco de dados
- Executar scripts SQL
- Fazer correções manuais

## Logs Esperados

Durante o build, você verá:

```
🔍 Verificando migrações falhadas...
⚠️  Encontradas 1 migrações falhadas:
   - 20260321225645_make_slug_required_and_unique

🔧 Corrigindo migração do slug...
1️⃣ Preenchendo slugs nulos...
   ✅ X registros atualizados
2️⃣ Resolvendo duplicatas...
   ✅ Duplicatas resolvidas
3️⃣ Verificando resultado...
   📊 Total: X, Nulos: 0, Únicos: X
4️⃣ Removendo migração falhada do registro...
   ✅ Migração removida

✅ Correção concluída! As migrações podem prosseguir.
```

## Rollback (Se Necessário)

Se por algum motivo precisar reverter:

```bash
# Remover o script de pré-migração do build
# Editar package.json:
"build": "prisma generate && prisma migrate deploy && tsc"
```

## Monitoramento

Após o deploy, verifique:
1. Build completou com sucesso
2. Aplicação iniciou normalmente
3. Endpoints da API estão respondendo
4. Não há erros relacionados ao campo `slug` nos logs
