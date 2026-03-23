---
inclusion: auto
---

# RBAC Rules and Guidelines

Este documento define as regras e padrões de controle de acesso baseado em roles (RBAC) implementados no Trinity Scheduler Core.

## Roles Disponíveis

### Admin
- **Acesso**: Completo e irrestrito a todas as funcionalidades
- **Escopo**: Cross-tenant (bypassa o `tenantFilter` — pode acessar dados de qualquer shop)
- **Permissões**: Todas as operações CRUD em todos os recursos

### Leader
- **Acesso**: Completo dentro do estabelecimento
- **Escopo**: Todos os dados do shop (shopId)
- **Permissões**:
  - Visualizar e gerenciar todos os profissionais, clientes e agendamentos
  - Criar credenciais de acesso para profissionais
  - Acessar todos os relatórios e dashboards

### Professional
- **Acesso**: Restrito aos próprios dados
- **Escopo**: Apenas registros onde `professionalId` corresponde ao ID do profissional
- **Permissões**:
  - Visualizar apenas próprios agendamentos
  - Visualizar apenas própria receita
  - Visualizar e editar apenas próprio perfil
  - Sem permissão para criar/excluir profissionais
  - Sem acesso a dados de outros profissionais

## Middleware de Autorização

O middleware `authorize()` em `src/middlewares/authorize.ts` valida a role e registra tentativas de acesso negado via `logging.service.ts`:

```typescript
import { authorize } from '../middlewares/authorize';

// Acessível por leader, professional e admin
router.get('/dashboard/stats', authorize('leader', 'professional', 'admin'), handler);

// Acessível apenas por leader e admin
router.post('/professionals', authorize('leader', 'admin'), handler);
```

## Data Filter Utility

Use `applyProfessionalFilter()` de `src/utils/dataFilter.ts` para aplicar filtros automáticos em queries de agendamentos e receita:

```typescript
import { applyProfessionalFilter } from '../utils/dataFilter';

const where: Record<string, unknown> = {};
if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

const filteredWhere = applyProfessionalFilter(where, {
  role: req.user?.role || 'leader',
  professionalId: req.user?.professionalId
});

const appointments = await prisma.appointment.findMany({ where: filteredWhere });
```

## Padrão de Implementação

Para endpoints que retornam agendamentos, receita ou dados de profissionais:

```typescript
// 1. Where base
const where: Record<string, unknown> = {};
if (shopId && req.user?.role !== 'admin') where.shopId = shopId;
if (unitId) where.unitId = unitId;
if (startDate || endDate) {
  where.date = {
    ...(startDate ? { gte: startDate } : {}),
    ...(endDate ? { lte: endDate } : {}),
  };
}

// 2. Aplicar filtro profissional
const filteredWhere = applyProfessionalFilter(where, {
  role: req.user?.role || 'leader',
  professionalId: req.user?.professionalId
});

// 3. Query
const data = await prisma.appointment.findMany({ where: filteredWhere });
```

## Controle de Acesso Específico

### Detalhe de Profissional

```typescript
router.get('/professionals/:id', authorize('leader', 'professional', 'admin'), async (req, res, next) => {
  const { id } = req.params;

  if (req.user?.role === 'professional' && req.user.professionalId !== id) {
    throw new AppError(403, 'FORBIDDEN', 'Profissional só pode acessar o próprio registro');
  }
  // ...
});
```

### Edição de Profissional

```typescript
router.put('/professionals/:id', authorize('leader', 'professional', 'admin'), async (req, res, next) => {
  const { id } = req.params;

  if (req.user?.role === 'professional' && req.user.professionalId !== id) {
    throw new AppError(403, 'FORBIDDEN', 'Profissional só pode editar o próprio registro');
  }
  // ...
});
```

### Listagem de Profissionais

Professional vê apenas o próprio registro — filtro direto por ID:

```typescript
const where: Record<string, unknown> = { deletedAt: null };
if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

if (req.user?.role === 'professional' && req.user.professionalId) {
  where.id = req.user.professionalId;
}
```

### Listagem de Unidades

Professional vê apenas unidades às quais está alocado:

```typescript
if (req.user?.role === 'professional' && req.user.professionalId) {
  const allocations = await prisma.professionalUnit.findMany({
    where: { professionalId: req.user.professionalId },
    select: { unitId: true },
  });
  const unitIds = allocations.map((a) => a.unitId);
  // Inclui também o unitId legado
  const professional = await prisma.professional.findUnique({
    where: { id: req.user.professionalId },
    select: { unitId: true },
  });
  if (professional?.unitId && !unitIds.includes(professional.unitId)) {
    unitIds.push(professional.unitId);
  }
  where.id = { in: unitIds };
}
```

## Criação de Credenciais para Profissionais

Leaders e admins podem criar credenciais ao cadastrar ou atualizar profissionais:

```typescript
import {
  createProfessionalCredentials,
  updateProfessionalCredentials,
  getProfessionalUser
} from '../services/professionalCredentials.service';

// Na criação — rollback automático se falhar
if (credentials?.email && credentials?.password) {
  try {
    await createProfessionalCredentials({
      professionalId: professional.id,
      shopId,
      name: professional.name,
      email: credentials.email,
      password: credentials.password,
    });
  } catch (credErr) {
    await prisma.professional.delete({ where: { id: professional.id } });
    throw credErr;
  }
}

// Na atualização
if (credentials && (credentials.email || credentials.password)) {
  const existingUser = await getProfessionalUser(id);
  if (existingUser) {
    await updateProfessionalCredentials({
      professionalId: id,
      email: credentials.email,
      password: credentials.password,
    });
  } else if (credentials.email && credentials.password) {
    await createProfessionalCredentials({ professionalId: id, shopId, name, email, password });
  }
}
```

## Logging de Segurança

O middleware `authorize()` registra automaticamente tentativas de acesso negado via `logging.service.ts`:

```typescript
import { logAccessDenied } from '../services/logging.service';

logAccessDenied({
  userId: req.user.id,
  role: req.user.role,
  endpoint: req.path,
  method: req.method,
  timestamp: new Date(),
  ip: req.ip || req.headers['x-forwarded-for'],
  userAgent: req.headers['user-agent'],
});
```

## Mensagens de Erro Padrão

```typescript
throw new AppError(401, 'UNAUTHORIZED', 'Não autenticado');
throw new AppError(403, 'FORBIDDEN', 'Sem permissão para este recurso');
throw new AppError(403, 'FORBIDDEN', 'Profissional só pode acessar o próprio registro');
throw new AppError(403, 'FORBIDDEN', 'Profissional só pode editar o próprio registro');
throw new AppError(409, 'CONFLICT', 'Email já está em uso');
```

## Checklist para Novos Endpoints

- [ ] Adicionar `authorize()` com roles apropriadas
- [ ] Se retorna appointments/revenue, aplicar `applyProfessionalFilter()`
- [ ] Se acessa profissional por ID, verificar se professional pode acessar
- [ ] Se modifica profissional, verificar se professional pode editar
- [ ] Testar com as três roles (admin, leader, professional)
- [ ] Verificar que professional vê apenas próprios dados
- [ ] Verificar que leader vê todos os dados do shop
- [ ] Adicionar documentação Swagger com roles permitidas

## Armadilhas Comuns

### Filtro manual incorreto

```typescript
// ERRADO — não usa a utility
if (req.user?.role === 'professional') {
  where.professionalId = req.user.professionalId;
}

// CORRETO — usa applyProfessionalFilter
const filteredWhere = applyProfessionalFilter(where, {
  role: req.user?.role || 'leader',
  professionalId: req.user?.professionalId
});
```

### Esqueceu verificação de acesso ao detalhe

```typescript
// ERRADO — professional pode ver qualquer profissional
router.get('/professionals/:id', authorize('leader', 'professional', 'admin'), async (req, res) => {
  const professional = await prisma.professional.findFirst({ where: { id } });
  res.json(professional);
});

// CORRETO — verifica acesso explicitamente
router.get('/professionals/:id', authorize('leader', 'professional', 'admin'), async (req, res) => {
  const { id } = req.params;
  if (req.user?.role === 'professional' && req.user.professionalId !== id) {
    throw new AppError(403, 'FORBIDDEN', 'Profissional só pode acessar o próprio registro');
  }
  const professional = await prisma.professional.findFirst({ where: { id } });
  res.json(professional);
});
```

## Princípios de Segurança

### Defense in Depth

1. **Middleware Layer**: `authorize()` valida role antes do processamento
2. **Data Layer**: `applyProfessionalFilter()` aplica filtros automáticos nas queries
3. **Business Logic**: Verificações explícitas quando necessário (detalhe/edição de profissional)

### Least Privilege

- Professional: acesso mínimo (apenas próprios dados)
- Leader: acesso ao estabelecimento
- Admin: acesso completo (cross-tenant)

### Audit Trail

Todas as tentativas de acesso negado são registradas via `logging.service.ts` para auditoria.

## Referências

- Data Filter: `src/utils/dataFilter.ts`
- Authorize Middleware: `src/middlewares/authorize.ts`
- Logging Service: `src/services/logging.service.ts`
- Credentials Service: `src/services/professionalCredentials.service.ts`
- Tenant Filter: `src/middlewares/tenantFilter.ts`
