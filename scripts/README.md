# Scripts de Migração de Dados

Este diretório contém scripts de migração de dados para o Trinity Scheduler Core.

## Script de Migração de Slugs de Unidades

### Visão Geral

O script `migrate-unit-slugs.ts` popula o campo `slug` para todas as unidades que ainda não possuem um slug. Este script é necessário após a adição do campo `slug` ao modelo `Unit` no banco de dados.

### Funcionalidades

- **Geração Automática**: Gera slugs a partir dos nomes das unidades usando sanitização inteligente
- **Garantia de Unicidade**: Adiciona sufixos numéricos (slug-2, slug-3, etc.) quando há conflitos
- **Validação**: Garante que todos os slugs gerados são válidos para uso como subdomínios DNS
- **Logging Detalhado**: Fornece feedback claro sobre o progresso e resultados da migração
- **Segurança**: Não modifica unidades que já possuem slugs

### Como Usar

#### 1. Dry Run (Recomendado)

Antes de executar a migração real, execute o dry-run para visualizar quais slugs seriam gerados:

```bash
yarn tsx scripts/migrate-unit-slugs-dry-run.ts
```

Ou adicione ao package.json e execute:

```bash
yarn migrate:slugs:preview
```

#### 2. Executar Migração

Após revisar o dry-run, execute a migração real:

```bash
yarn tsx scripts/migrate-unit-slugs.ts
```

Ou use o script do package.json:

```bash
yarn migrate:slugs
```

### Exemplo de Saída

```
🚀 Starting unit slug migration...

📊 Found 3 units without slugs

📋 Found 1 existing slugs in database

✅ Unit "Trinity Barber" → slug: "trinity-barber"
✅ Unit "Salão São Paulo" → slug: "salao-sao-paulo"
🔄 Slug "trinity-barber" already exists. Using "trinity-barber-2" instead.
✅ Unit "Trinity Barber Centro" → slug: "trinity-barber-2"

==================================================
📈 Migration Summary:
   ✅ Success: 3
   ❌ Errors: 0
   📊 Total: 3
==================================================

🎉 Migration completed successfully!
```

### Regras de Geração de Slugs

O script aplica as seguintes regras ao gerar slugs:

1. **Conversão para minúsculas**: Todos os caracteres são convertidos para lowercase
2. **Remoção de acentos**: Caracteres acentuados são normalizados (São → sao)
3. **Substituição de espaços**: Espaços são substituídos por hífens
4. **Remoção de caracteres especiais**: Apenas letras, números e hífens são permitidos
5. **Normalização de hífens**: Múltiplos hífens consecutivos são reduzidos a um
6. **Limpeza de bordas**: Hífens no início e fim são removidos
7. **Validação de comprimento**: Slugs devem ter entre 3 e 63 caracteres
8. **Validação de formato**: Devem iniciar e terminar com letra ou número

### Tratamento de Conflitos

Quando um slug gerado já existe no banco de dados:

- O script adiciona um sufixo numérico: `-2`, `-3`, `-4`, etc.
- Continua incrementando até encontrar um slug disponível
- A verificação é case-insensitive para garantir unicidade real

### Casos Especiais

#### Nomes Vazios ou Muito Curtos

Se após sanitização o nome resultar em um slug vazio ou muito curto (< 3 caracteres), o script usa um fallback:

```
unit-{random-id}
```

Exemplo: `unit-a7b3c9d`

#### Nomes Muito Longos

Slugs são truncados para o máximo de 63 caracteres (limite DNS), removendo hífens finais se necessário.

### Segurança

- **Idempotente**: Pode ser executado múltiplas vezes sem efeitos colaterais
- **Não destrutivo**: Não modifica unidades que já possuem slugs
- **Transacional**: Cada atualização é uma transação separada
- **Logging completo**: Todos os erros são registrados com detalhes

### Troubleshooting

#### Erro: "Database connection failed"

Verifique se:
- O PostgreSQL está rodando
- As credenciais no `.env` estão corretas
- A variável `DATABASE_URL` está configurada

#### Erro: "Slug validation failed"

Isso pode ocorrer se o nome da unidade contém apenas caracteres especiais. O script automaticamente usa um fallback neste caso.

#### Slugs Duplicados Após Migração

Isso não deveria acontecer, mas se ocorrer:
1. Execute o dry-run para identificar o problema
2. Verifique se há unidades com nomes idênticos
3. O script automaticamente adiciona sufixos numéricos

### Próximos Passos

Após executar este script com sucesso:

1. Execute a migração Prisma para tornar o campo `slug` obrigatório:
   ```bash
   yarn prisma migrate dev
   ```

2. Verifique se todos os endpoints da API estão funcionando corretamente

3. Teste a resolução de slugs no client app

### Suporte

Para problemas ou dúvidas sobre este script, consulte:
- Design Document: `trinity-scheduler-admin/.kiro/specs/unit-slug-subdomain-system/design.md`
- Requirements: `trinity-scheduler-admin/.kiro/specs/unit-slug-subdomain-system/requirements.md`
