---
inclusion: auto
---

# RBAC Rules and Guidelines

Este documento define as regras e padrões de controle de acesso baseado em roles (RBAC) implementados no Trinity Scheduler Core.

## Roles Disponíveis

### Admin
- **Acesso**: Completo e irrestrito a todas as funcionalidades
- **Escopo**: Cross-tenant (pode acessar dados de múltiplos estabelecimentos)
- **Permissões**: Todas as operações CRUD em todos os recursos

### Leader
- **Acesso**: Completo dentro do estabelecimento
- **Escopo**: Todos os dados do shop (shopId)
- **Permissões**:
  - Visualizar e gerenciar todos os profissionais
  - Visualizar e gerenciar todos os clientes
  - Visualizar e gerenciar todos os agendamentos
  - Criar credenciais de acesso para profissionais
  - Acessar todos os relatórios e dashboards

### Professional
- **Acesso**: Restrito aos próprios dados
- **Escopo**: Apenas registros onde professionalId corresponde ao ID do profissional
- **Permissões**:
  - Visualizar apenas próprios agendamentos
  - Visualizar apenas própria receita
  - Visualizar e editar apenas próprio perfil
  - Sem permissão para criar/excluir profissionais
  - Sem acesso a dados de outros profissionais

## Filtragem Automática de Dados

### Middleware de Autorização

O middleware `authorize()` valida a role do usuário antes de processar requisições:

```typescript
import { authorize } from '../middlewares/authorize';

// Exemplo: endpoint acessível por leader, professional e admin
router.get('/dashboard/stats', authorize('leader', 'professional', 'admin'), handler);

// Exemplo: endpoint acessível apenas por leader e admin
router.post('/professionals', authorize('leader', 'admin'), handler);
```

### Data Filter Utility

Use `applyProfessionalFilter()` para aplicar filtros automáticos em queries:

```typescript
import { applyProfessionalFilter } from '../utils/dataFilter';

const where: Record<string, unknown> = { date };
if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

// Aplica filtro profissional automaticamente
const filteredWhere = applyProfessionalFilter(where, {
  role: req.user?.role || 'leader',
  professionalId: req.user?.professionalId
});

const appointments = await prisma.appointment.findMany({
  where: filteredWhere,
  // ...
});
```

### Padrão de Implementação

Para endpoints que retornam dados de agendamentos, receita ou profissionais:

1. **Construa o where base** com filtros comuns (shopId, date, unitId, etc.)
2. **Aplique applyProfessionalFilter()** para adicionar filtro de professionalId quando necessário
3. **Execute a query** com o where filtrado

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

### Detalhes de Profissional

Profissionais só podem acessar o próprio registro:

```typescript
router.get('/professionals/:id', authorize('leader', 'professional', 'admin'), async (req, res, next) => {
  const { id } = req.params;
  
  // Verificação explícita de acesso
  if (req.user?.role === 'professional' && req.user.professionalId !== id) {
    throw new AppError(403, 'FORBIDDEN', 'Profissional só pode acessar o próprio registro');
  }
  
  // ... resto da lógica
});
```

### Edição de Profissional

Profissionais só podem editar o próprio registro:

```typescript
router.put('/professionals/:id', authorize('leader', 'professional', 'admin'), async (req, res, next) => {
  const { id } = req.params;
  
  // Verificação explícita de edição
  if (req.user?.role === 'professional' && req.user.professionalId !== id) {
    throw new AppError(403, 'FORBIDDEN', 'Profissional só pode editar o próprio registro');
  }
  
  // ... resto da lógica
});
```

### Listagem de Profissionais

Profissionais veem apenas o próprio registro:

```typescript
const where: Record<string, unknown> = { deletedAt: null };
if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

// Filtro direto por ID para profissionais
if (req.user?.role === 'professional' && req.user.professionalId) {
  where.id = req.user.professionalId;
}
```

## Criação de Credenciais

### Criar Profissional com Credenciais

Leaders e admins podem criar credenciais ao cadastrar profissionais:

```typescript
import { createProfessionalCredentials } from '../services/professionalCredentials.service';

const { credentials, ...professionalData } = req.body;

// Criar profissional
const professional = await prisma.professional.create({
  data: { ...professionalData, shopId }
});

// Criar credenciais se fornecidas
if (credentials && credentials.email && credentials.password) {
  await createProfessionalCredentials({
    professionalId: professional.id,
    shopId,
    name: professional.name,
    email: credentials.email,
    password: credentials.password,
  });
}
```

### Atualizar Credenciais

Leaders e admins podem atualizar credenciais de profissionais:

```typescript
import { 
  getProfessionalUser, 
  updateProfessionalCredentials, 
  createProfessionalCredentials 
} from '../services/professionalCredentials.service';

const { credentials } = req.body;

if (credentials && (credentials.email || credentials.password)) {
  const existingUser = await getProfessionalUser(id);
  
  if (existingUser) {
    // Atualizar credenciais existentes
    await updateProfessionalCredentials({
      professionalId: id,
      email: credentials.email,
      password: credentials.password,
    });
  } else if (credentials.email && credentials.password) {
    // Criar novas credenciais (ambos email e password obrigatórios)
    await createProfessionalCredentials({
      professionalId: id,
      shopId: professional.shopId,
      name: professional.name,
      email: credentials.email,
      password: credentials.password,
    });
  }
}
```

## Logging de Segurança

Todas as tentativas de acesso negado são registradas automaticamente:

```typescript
import { logAccessDenied } from '../services/logging.service';

// O middleware authorize() já faz isso automaticamente
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

Formato do log:

```json
{
  "level": "WARN",
  "event": "ACCESS_DENIED",
  "userId": "uuid",
  "role": "professional",
  "endpoint": "/admin/professionals/other-id",
  "method": "GET",
  "timestamp": "2025-01-15T10:30:00Z",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

## Mensagens de Erro

### Padrão de Erros de Autorização

```typescript
// 401 - Não autenticado
throw new AppError(401, 'UNAUTHORIZED', 'Não autenticado');

// 403 - Sem permissão (role inválida)
throw new AppError(403, 'FORBIDDEN', 'Sem permissão para este recurso');

// 403 - Profissional tentando acessar dados de outro
throw new AppError(403, 'FORBIDDEN', 'Profissional só pode acessar próprios dados');

// 403 - Profissional tentando editar outro registro
throw new AppError(403, 'FORBIDDEN', 'Profissional só pode editar o próprio registro');

// 409 - Email já em uso
throw new AppError(409, 'CONFLICT', 'Email já está em uso');
```

## Checklist para Novos Endpoints

Ao criar novos endpoints administrativos, siga este checklist:

- [ ] Adicionar middleware `authorize()` com roles apropriadas
- [ ] Se retorna dados de appointments/revenue, aplicar `applyProfessionalFilter()`
- [ ] Se acessa profissional por ID, verificar se professional pode acessar
- [ ] Se modifica profissional, verificar se professional pode editar
- [ ] Testar com as três roles (admin, leader, professional)
- [ ] Verificar que professional vê apenas próprios dados
- [ ] Verificar que leader vê todos os dados do shop
- [ ] Adicionar documentação Swagger com roles permitidas
- [ ] Adicionar testes de autorização

## Armadilhas Comuns

### ❌ Não fazer isso

```typescript
// Filtro manual incorreto - não usa a utility
if (req.user?.role === 'professional') {
  where.professionalId = req.user.professionalId;
}
```

### ✅ Fazer isso

```typescript
// Usa a utility para aplicar filtro consistentemente
const filteredWhere = applyProfessionalFilter(where, {
  role: req.user?.role || 'leader',
  professionalId: req.user?.professionalId
});
```

### ❌ Não fazer isso

```typescript
// Esqueceu de verificar acesso ao detalhe
router.get('/professionals/:id', authorize('leader', 'professional', 'admin'), async (req, res) => {
  const professional = await prisma.professional.findFirst({ where: { id } });
  res.json(professional); // Professional pode ver qualquer profissional!
});
```

### ✅ Fazer isso

```typescript
// Verifica acesso explicitamente
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

O sistema implementa múltiplas camadas de segurança:

1. **Middleware Layer**: Validação de role antes do processamento
2. **Data Layer**: Filtros automáticos no nível de query
3. **Business Logic**: Verificações explícitas quando necessário

### Least Privilege

Cada role tem apenas as permissões necessárias:

- Professional: acesso mínimo (apenas próprios dados)
- Leader: acesso ao estabelecimento
- Admin: acesso completo

### Audit Trail

Todas as tentativas de acesso negado são registradas para auditoria e monitoramento de segurança.

## Exemplos Completos

### Endpoint de Dashboard

```typescript
router.get('/dashboard/stats', 
  authorize('leader', 'professional', 'admin'), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = req.shopId || req.user?.shopId;
      const { date, unitId } = req.query;

      if (!date) throw new AppError(400, 'VALIDATION_ERROR', 'Query param date é obrigatório');

      const where: Record<string, unknown> = { date };
      if (shopId && req.user?.role !== 'admin') where.shopId = shopId;
      if (unitId) where.unitId = unitId;

      // Aplicar filtro profissional
      const filteredWhere = applyProfessionalFilter(where, {
        role: req.user?.role || 'leader',
        professionalId: req.user?.professionalId
      });

      const appointments = await prisma.appointment.findMany({
        where: filteredWhere,
        include: { service: { select: { name: true } } },
      });

      // Calcular métricas...
      res.json({ revenue, appointmentCount, topService, newClients });
    } catch (err) {
      next(err);
    }
  }
);
```

### Endpoint de Revenue

```typescript
router.get('/revenue/summary', 
  authorize('leader', 'professional', 'admin'), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = req.shopId || req.user?.shopId;
      const { unitId, staffId, startDate, endDate } = req.query;

      const where: Record<string, unknown> = {};
      if (shopId && req.user?.role !== 'admin') where.shopId = shopId;
      
      // Aplicar filtro profissional
      const filteredWhere = applyProfessionalFilter(where, {
        role: req.user?.role || 'leader',
        shopId,
        professionalId: req.user?.professionalId
      });
      
      // Outros filtros
      if (unitId) filteredWhere.unitId = unitId;
      if (staffId) filteredWhere.professionalId = staffId; // Override
      
      const appointments = await prisma.appointment.findMany({
        where: filteredWhere,
        include: {
          service: { select: { name: true } },
          professional: { select: { id: true, name: true } },
        },
      });

      // Calcular métricas e filtrar staffRanking para professionals...
      res.json({ totalRevenue, averageTicket, staffRanking, ... });
    } catch (err) {
      next(err);
    }
  }
);
```

## Referências

- Spec: `.kiro/specs/role-based-access-control/`
- Data Filter: `src/utils/dataFilter.ts`
- Authorize Middleware: `src/middlewares/authorize.ts`
- Logging Service: `src/services/logging.service.ts`
- Credentials Service: `src/services/professionalCredentials.service.ts`
