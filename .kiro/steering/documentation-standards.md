---
inclusion: manual
---

# Documentation Standards

## Objetivo

Este guia define os padrões para criar documentação técnica na pasta `docs/` para todas as funcionalidades e entidades do sistema.

## Estrutura de Pastas

```
docs/
├── entities/           # Documentação de entidades do domínio
│   ├── CLIENT.md
│   ├── PROFESSIONAL.md
│   ├── SERVICE.md
│   ├── APPOINTMENT.md
│   └── UNIT.md
├── features/          # Documentação de funcionalidades
│   ├── AUTHENTICATION.md
│   ├── SCHEDULING.md
│   ├── AVAILABILITY.md
│   └── REVENUE.md
├── api/               # Documentação de APIs
│   ├── PAGINATION.md
│   └── ERROR-HANDLING.md
└── architecture/      # Documentação de arquitetura
    ├── DATABASE.md
    └── MIDDLEWARE.md
```

## Template para Entidades

Ao documentar uma entidade, use o seguinte template:

```markdown
# [Nome da Entidade]

## Visão Geral

Breve descrição da entidade e seu propósito no sistema.

## Modelo de Dados

### Schema Prisma

\`\`\`prisma
model [Entity] {
  // Schema completo
}
\`\`\`

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| id | String (UUID) | Sim | Identificador único |
| ... | ... | ... | ... |

### Relacionamentos

- **Relação com X**: Descrição do relacionamento
- **Relação com Y**: Descrição do relacionamento

## Endpoints da API

### Admin Endpoints

#### Listar [Entidades]
\`\`\`
GET /admin/[entities]
\`\`\`

**Parâmetros:**
- `page` (integer, default: 1)
- `pageSize` (integer, default: 25)
- `search` (string, opcional)
- `sortBy` (string, default: "name")
- `sortOrder` (enum: "asc" | "desc")

**Resposta:**
\`\`\`json
{
  "data": [...],
  "total": 150
}
\`\`\`

#### Obter [Entidade] por ID
\`\`\`
GET /admin/[entities]/:id
\`\`\`

#### Criar [Entidade]
\`\`\`
POST /admin/[entities]
\`\`\`

**Body:**
\`\`\`json
{
  "field1": "value",
  "field2": "value"
}
\`\`\`

#### Atualizar [Entidade]
\`\`\`
PUT /admin/[entities]/:id
\`\`\`

#### Excluir [Entidade]
\`\`\`
DELETE /admin/[entities]/:id
\`\`\`

### Client Endpoints

(Se aplicável)

## Regras de Negócio

1. **Regra 1**: Descrição
2. **Regra 2**: Descrição
3. **Regra 3**: Descrição

## Validações

- Campo X deve ser único por shop
- Campo Y é obrigatório quando Z está presente
- Formato de campo W: regex ou descrição

## Permissões

| Ação | Admin | Leader | Professional | Client |
|------|-------|--------|--------------|--------|
| Listar | ✅ | ✅ | ✅ | ❌ |
| Visualizar | ✅ | ✅ | ✅ | ❌ |
| Criar | ✅ | ✅ | ❌ | ❌ |
| Editar | ✅ | ✅ | Próprio | ❌ |
| Excluir | ✅ | ✅ | ❌ | ❌ |

## Exemplos de Uso

### Criar [Entidade]

\`\`\`bash
curl -X POST https://api.example.com/admin/[entities] \\
  -H "Authorization: Bearer TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "field1": "value",
    "field2": "value"
  }'
\`\`\`

### Listar com Filtros

\`\`\`bash
curl -X GET "https://api.example.com/admin/[entities]?page=1&pageSize=25&search=termo" \\
  -H "Authorization: Bearer TOKEN"
\`\`\`

## Casos de Uso Comuns

1. **Caso de Uso 1**: Descrição e exemplo
2. **Caso de Uso 2**: Descrição e exemplo

## Considerações Técnicas

- Performance: Índices, otimizações
- Segurança: Validações, sanitização
- Escalabilidade: Limitações conhecidas

## Histórico de Mudanças

| Data | Versão | Descrição |
|------|--------|-----------|
| 2026-03-20 | 1.0 | Criação inicial |
```

## Template para Funcionalidades

Ao documentar uma funcionalidade, use o seguinte template:

```markdown
# [Nome da Funcionalidade]

## Visão Geral

Descrição da funcionalidade e seu propósito no sistema.

## Arquitetura

### Componentes Envolvidos

- **Backend**: Serviços, rotas, middlewares
- **Frontend**: Componentes, hooks, páginas
- **Database**: Tabelas, relacionamentos

### Fluxo de Dados

\`\`\`
Cliente → API → Middleware → Service → Database
\`\`\`

## Endpoints

### [Endpoint 1]

\`\`\`
METHOD /path
\`\`\`

**Descrição**: O que faz

**Autenticação**: Requerida/Opcional

**Permissões**: Roles necessárias

**Parâmetros**: Lista de parâmetros

**Resposta**: Formato da resposta

**Erros Possíveis**:
- 400: Descrição
- 404: Descrição
- 500: Descrição

## Regras de Negócio

1. **Regra 1**: Descrição detalhada
2. **Regra 2**: Descrição detalhada

## Validações

- Validação 1
- Validação 2

## Casos de Uso

### Caso de Uso 1: [Nome]

**Ator**: Quem executa

**Pré-condições**: O que deve existir antes

**Fluxo Principal**:
1. Passo 1
2. Passo 2
3. Passo 3

**Fluxo Alternativo**:
- Se X, então Y

**Pós-condições**: O que acontece após

## Exemplos

### Exemplo 1

\`\`\`bash
# Comando ou código
\`\`\`

**Resultado esperado**: Descrição

## Testes

### Testes Unitários

- Teste 1: Descrição
- Teste 2: Descrição

### Testes de Integração

- Teste 1: Descrição
- Teste 2: Descrição

## Troubleshooting

### Problema 1

**Sintoma**: Descrição

**Causa**: Explicação

**Solução**: Como resolver

## Melhorias Futuras

- [ ] Melhoria 1
- [ ] Melhoria 2

## Referências

- Link para código relevante
- Link para documentação externa
- Link para issues relacionadas
```

## Regras de Escrita

### Linguagem

- Escrever em **português brasileiro**
- Usar termos técnicos em inglês quando apropriado (ex: endpoint, query, payload)
- Manter consistência de terminologia

### Formatação

- Usar Markdown padrão
- Código em blocos com syntax highlighting
- Tabelas para dados estruturados
- Listas para enumerações
- Emojis para status (✅ ❌ ⚠️)

### Exemplos

- Sempre incluir exemplos práticos
- Usar dados fictícios realistas
- Incluir comandos curl completos
- Mostrar respostas esperadas

### Manutenção

- Atualizar documentação junto com código
- Incluir data de última atualização
- Manter histórico de mudanças
- Revisar periodicamente

## Checklist de Documentação

Ao criar documentação, verificar:

- [ ] Título claro e descritivo
- [ ] Visão geral explicativa
- [ ] Schema/modelo de dados (se aplicável)
- [ ] Lista completa de endpoints
- [ ] Exemplos de requisições e respostas
- [ ] Regras de negócio documentadas
- [ ] Permissões especificadas
- [ ] Validações listadas
- [ ] Casos de uso descritos
- [ ] Exemplos práticos incluídos
- [ ] Erros possíveis documentados
- [ ] Considerações técnicas mencionadas
- [ ] Código formatado corretamente
- [ ] Links para recursos relacionados

## Quando Criar Documentação

### Obrigatório

- Nova entidade criada
- Nova funcionalidade implementada
- Mudança significativa em API
- Novo padrão arquitetural

### Recomendado

- Refatoração importante
- Correção de bug complexo
- Otimização de performance
- Mudança de comportamento

## Localização dos Arquivos

### Entidades

Criar em `docs/entities/[ENTITY-NAME].md`

Exemplo: `docs/entities/PROFESSIONAL.md`

### Funcionalidades

Criar em `docs/features/[FEATURE-NAME].md`

Exemplo: `docs/features/SCHEDULING.md`

### APIs

Criar em `docs/api/[API-NAME].md`

Exemplo: `docs/api/PAGINATION.md`

### Arquitetura

Criar em `docs/architecture/[TOPIC-NAME].md`

Exemplo: `docs/architecture/MIDDLEWARE.md`

## Exemplo de Uso deste Steering

Quando o usuário pedir para documentar algo:

1. Identificar o tipo (entidade, funcionalidade, API, arquitetura)
2. Escolher o template apropriado
3. Criar arquivo na pasta correta
4. Preencher todas as seções relevantes
5. Incluir exemplos práticos
6. Revisar checklist

## Referências

- Este steering file
- Documentação existente em `docs/`
- Código fonte em `src/`
- Schema Prisma em `prisma/schema.prisma`
