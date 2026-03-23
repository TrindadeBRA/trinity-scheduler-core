# Project Structure

## Root Directory

```
trinity-scheduler-core/
├── src/                    # Código fonte
├── prisma/                 # Schema e migrations do Prisma
├── dist/                   # JavaScript compilado
├── docs/                   # Documentação
├── scripts/                # Scripts de migração de dados
├── .kiro/                  # Configuração Kiro (specs, steering)
├── docker-compose.yml      # Setup do container PostgreSQL
└── node_modules/           # Dependências
```

## Source Directory (`src/`)

```
src/
├── routes/                 # Route handlers da API
│   ├── admin/             # Rotas do painel admin (/admin/*)
│   │   ├── auth.routes.ts           # Login, register, forgot/reset-password, me, profile
│   │   ├── appointments.routes.ts   # CRUD de agendamentos
│   │   ├── clients.routes.ts        # CRUD de clientes
│   │   ├── professionals.routes.ts  # CRUD de profissionais + alocação de unidades
│   │   ├── services.routes.ts       # CRUD de serviços e adicionais
│   │   ├── units.routes.ts          # CRUD de unidades + gestão de slugs
│   │   ├── dashboard.routes.ts      # Stats, weekly-revenue, weekly-cancelled
│   │   ├── revenue.routes.ts        # Revenue summary com filtros
│   │   ├── shop.routes.ts           # Shop info, shop hours, niches
│   │   ├── upload.routes.ts         # Presigned URL para upload S3/R2
│   │   ├── system.routes.ts         # Utilitários do sistema (apenas admin)
│   │   └── __tests__/               # Testes de rotas
│   ├── client/            # Rotas da app cliente
│   │   ├── auth.routes.ts           # Login por telefone, validate, patch name
│   │   ├── appointments.routes.ts   # Criar, listar, cancelar agendamentos
│   │   ├── services.routes.ts       # Listar serviços (type=service, active=true)
│   │   ├── addons.routes.ts         # Listar adicionais (type=addon, active=true)
│   │   ├── professionals.routes.ts  # Listar profissionais ativos
│   │   ├── availability.routes.ts   # Slots disponíveis e datas desabilitadas
│   │   ├── shop.routes.ts           # Info pública do estabelecimento
│   │   └── units.routes.ts          # Resolver slug → shopId/unitId
│   ├── public.routes.ts   # Rotas públicas (/public/niches)
│   └── index.ts           # Montagem e registro de todas as rotas
├── services/              # Serviços de lógica de negócio
│   ├── appointment.service.ts       # createAppointment, cancelAppointment, completeAppointment
│   ├── availability.service.ts      # getAvailableSlots, getDisabledDates
│   ├── cron.service.ts              # Jobs agendados (completar agendamentos passados)
│   ├── logging.service.ts           # Log de tentativas de acesso negado
│   └── professionalCredentials.service.ts  # Criar/atualizar credenciais de profissionais
├── middlewares/           # Middlewares Express
│   ├── auth.ts           # Verificação JWT, extrai userId/shopId/role
│   ├── authorize.ts      # Autorização por role + logging de acesso negado
│   ├── shopResolver.ts   # Extrai shopId do header X-Shop-Id
│   ├── tenantFilter.ts   # Injeta shopId em query/body/req.shopId
│   └── errorHandler.ts   # Tratamento global de erros
├── utils/                 # Funções utilitárias
│   ├── prisma.ts         # Singleton do Prisma Client
│   ├── jwt.ts            # signToken, verifyToken
│   ├── password.ts       # hashPassword, comparePassword (bcrypt)
│   ├── errors.ts         # Classe AppError(statusCode, code, message)
│   ├── pagination.ts     # parsePagination, createPaginatedResponse
│   ├── r2.ts             # Cliente S3/R2 e geração de presigned URLs
│   ├── slug.ts           # generateSlug, sanitizeSlug, validateSlug
│   ├── slug.test.ts      # Testes unitários do slug
│   ├── email.ts          # sendWelcomeLeader, sendPasswordResetEmail (nodemailer)
│   └── dataFilter.ts     # applyProfessionalFilter (filtro RBAC para queries)
├── config/                # Configuração
│   ├── env.ts            # Validação e exportação de variáveis de ambiente
│   ├── constants.ts      # SHOP_TIMEZONE = 'America/Sao_Paulo'
│   └── swagger.ts        # Configuração OpenAPI 3.0 (schemas + tags)
├── types/                 # Definições TypeScript
│   └── express.d.ts      # Extensões do Request Express (shopId, userId, role, user)
├── app.ts                 # Setup do Express (cors, json, swagger, routes, errorHandler)
└── index.ts               # Entry point (listen + initCronJobs)
```

## Endpoints Completos

### Admin Routes (`/admin/*`)

| Método | Endpoint | Roles | Descrição |
|--------|----------|-------|-----------|
| POST | `/admin/auth/login` | público | Login com email/senha |
| POST | `/admin/auth/register` | público | Registrar novo estabelecimento |
| POST | `/admin/auth/forgot-password` | público | Solicitar reset de senha |
| POST | `/admin/auth/reset-password` | público | Redefinir senha com token |
| GET | `/admin/auth/me` | auth | Dados do usuário autenticado |
| PATCH | `/admin/auth/profile` | auth | Atualizar nome, telefone, senha |
| GET | `/admin/shop` | auth | Dados do estabelecimento |
| PUT | `/admin/shop` | leader, admin | Atualizar estabelecimento |
| GET | `/admin/shop/hours` | auth | Horários de funcionamento |
| PUT | `/admin/shop/hours` | leader, admin | Atualizar horários |
| GET | `/admin/shop/niches` | auth | Listar nichos disponíveis |
| GET | `/admin/appointments` | leader, professional, admin | Listar agendamentos (paginado) |
| GET | `/admin/appointments/:id` | leader, professional, admin | Obter agendamento |
| POST | `/admin/appointments` | leader, admin | Criar agendamento |
| PUT | `/admin/appointments/:id` | leader, admin | Atualizar agendamento |
| DELETE | `/admin/appointments/:id` | leader, admin | Excluir agendamento |
| GET | `/admin/clients` | leader, professional, admin | Listar clientes (paginado) |
| GET | `/admin/clients/:id` | leader, professional, admin | Obter cliente |
| POST | `/admin/clients` | leader, admin | Criar cliente |
| PUT | `/admin/clients/:id` | leader, admin | Atualizar cliente |
| DELETE | `/admin/clients/:id` | leader, admin | Excluir cliente |
| GET | `/admin/services` | leader, professional, admin | Listar serviços (paginado) |
| GET | `/admin/services/:id` | leader, professional, admin | Obter serviço |
| POST | `/admin/services` | leader, admin | Criar serviço |
| PUT | `/admin/services/:id` | leader, admin | Atualizar serviço |
| DELETE | `/admin/services/:id` | leader, admin | Excluir serviço |
| GET | `/admin/professionals` | leader, professional, admin | Listar profissionais (paginado) |
| GET | `/admin/professionals/:id` | leader, professional, admin | Obter profissional |
| POST | `/admin/professionals` | leader, admin | Criar profissional |
| PUT | `/admin/professionals/:id` | leader, professional, admin | Atualizar profissional |
| DELETE | `/admin/professionals/:id` | leader, admin | Soft delete profissional |
| GET | `/admin/professionals/:id/units` | leader, professional, admin | Listar unidades do profissional |
| PUT | `/admin/professionals/:id/units` | leader, admin | Atualizar alocação de unidades |
| GET | `/admin/units` | leader, professional, admin | Listar unidades (paginado) |
| GET | `/admin/units/:id` | leader, professional, admin | Obter unidade |
| POST | `/admin/units` | leader, admin | Criar unidade |
| PUT | `/admin/units/:id` | leader, admin | Atualizar unidade |
| DELETE | `/admin/units/:id` | leader, admin | Excluir unidade |
| GET | `/admin/dashboard/stats` | leader, professional, admin | Estatísticas do dia |
| GET | `/admin/dashboard/weekly-revenue` | leader, professional, admin | Faturamento semanal |
| GET | `/admin/dashboard/weekly-cancelled` | leader, professional, admin | Cancelamentos semanais |
| GET | `/admin/revenue/summary` | leader, professional, admin | Resumo de faturamento |
| POST | `/admin/upload/presign` | leader, admin | Gerar presigned URL para upload |
| POST | `/admin/system/complete-past-appointments` | admin | Completar agendamentos passados |

### Client Routes

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | `/auth/login` | X-Shop-Id | Login por telefone (upsert cliente) |
| GET | `/auth/validate` | X-Shop-Id | Validar clientId existente |
| PATCH | `/auth/name` | X-Shop-Id | Atualizar nome do cliente |
| GET | `/services` | X-Shop-Id | Listar serviços ativos |
| GET | `/addons` | X-Shop-Id | Listar adicionais ativos |
| GET | `/professionals` | X-Shop-Id | Listar profissionais ativos |
| GET | `/availability/slots` | X-Shop-Id | Slots disponíveis por data |
| GET | `/availability/disabled-dates` | X-Shop-Id | Datas sem disponibilidade |
| POST | `/appointments` | X-Shop-Id | Criar agendamento |
| GET | `/appointments` | X-Shop-Id | Listar agendamentos do cliente |
| PATCH | `/appointments/:id/cancel` | X-Shop-Id | Cancelar agendamento |
| GET | `/client/shop/info` | X-Shop-Id | Info pública do estabelecimento |
| GET | `/client/units/resolve/:slug` | público | Resolver slug → shopId/unitId |

### Public Routes

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/public/niches` | Listar nichos disponíveis |

## Database Schema (Prisma)

### Modelos

| Modelo | Campos principais | Relacionamentos |
|--------|-------------------|-----------------|
| `Shop` | id, name, phone, email, address, niche, bookingBuffer | → Users, Services, Professionals, Clients, Units, Appointments, ShopHours |
| `User` | id, shopId, name, email, passwordHash, role, professionalId, resetToken | → Shop, Professional |
| `ShopHour` | id, shopId, day, start?, end? | → Shop |
| `Service` | id, shopId, name, duration, price, description, icon, image, type, active | → Shop, Appointments |
| `Professional` | id, shopId, unitId?, name, avatar, specialties[], phone, email, active, deletedAt | → Shop, Unit, WorkingHours, Appointments, User, ProfessionalUnits |
| `WorkingHour` | id, professionalId, day, start?, end?, lunchStart?, lunchEnd? | → Professional |
| `Client` | id, shopId, name?, phone, email, notes, birthday, totalSpent, lastVisit | → Shop, Appointments |
| `Appointment` | id, shopId, unitId?, clientId, serviceId, professionalId, date, time, duration, price, status, cancelReason, notes | → Shop, Unit, Client, Service, Professional, AppointmentAddons |
| `AppointmentAddon` | id, appointmentId, serviceId, name, duration, price | → Appointment |
| `Unit` | id, shopId, name, slug (unique), address?, phone? | → Shop, Professionals, ProfessionalUnits, Appointments |
| `ProfessionalUnit` | id, professionalId, unitId | → Professional, Unit |

### Enums

```typescript
enum Role { admin, leader, professional }
enum ServiceType { service, addon }
enum AppointmentStatus { confirmed, cancelled, completed, noshow }
```

> **Atenção**: O status `noshow` no banco é `noshow` (sem underscore), não `no_show`. O schema Swagger documenta incorretamente como `no_show`.

## Key Conventions

### Route Organization

- **Admin Routes** (`/admin/*`): Requerem JWT, operações CRUD completas
- **Client Routes**: Requerem `X-Shop-Id` header, operações de leitura e agendamento
- **Public Routes** (`/public/*`): Sem autenticação

### Middleware Chain

**Admin Routes (protegidas):**
1. `cors()` → `express.json()`
2. `authMiddleware` — verifica JWT, extrai userId/shopId/role/professionalId
3. `tenantFilter` — injeta shopId em query/body/req.shopId (admin bypassa)
4. `authorize([roles])` — verifica role
5. Route handler
6. `errorHandler`

**Client Routes:**
1. `cors()` → `express.json()`
2. `shopResolver` — extrai shopId do header `X-Shop-Id`
3. `tenantFilter` — injeta shopId
4. Route handler
5. `errorHandler`

**Admin Auth Routes** (`/admin/auth/*`): sem authMiddleware (públicas)

### Service Layer

- `appointment.service.ts`: `createAppointment` (com auto-atribuição de profissional), `cancelAppointment`, `completeAppointment`
- `availability.service.ts`: `getAvailableSlots`, `getDisabledDates` — calcula slots respeitando horários da loja, do profissional, almoço, agendamentos existentes e bookingBuffer
- `cron.service.ts`: `initCronJobs` — completa agendamentos `confirmed` de dias anteriores
- `logging.service.ts`: `logAccessDenied` — log estruturado de tentativas de acesso negado
- `professionalCredentials.service.ts`: `createProfessionalCredentials`, `updateProfessionalCredentials`, `getProfessionalUser`

### Error Handling

```typescript
throw new AppError(statusCode, code, message);
// Exemplos:
throw new AppError(400, 'VALIDATION_ERROR', 'Campo phone é obrigatório');
throw new AppError(401, 'UNAUTHORIZED', 'Token inválido ou expirado');
throw new AppError(403, 'FORBIDDEN', 'Sem permissão para este recurso');
throw new AppError(404, 'NOT_FOUND', 'Recurso não encontrado');
throw new AppError(409, 'CONFLICT', 'Horário não disponível');
```

### Slug System

- `generateSlug(name)`: gera slug a partir do nome (lowercase, sem acentos, hífens)
- `sanitizeSlug(slug)`: normaliza slug fornecido pelo usuário
- `validateSlug(slug)`: valida formato e retorna `{ valid, error }`
- Slugs são únicos globalmente (constraint `@unique` no Prisma)
- Lookup case-insensitive: `{ slug: { equals: slug, mode: 'insensitive' } }`

### Multi-Tenancy Pattern

1. Admin: JWT contém `shopId` → `tenantFilter` injeta em todas as queries
2. Client: header `X-Shop-Id` → `shopResolver` valida → `tenantFilter` injeta
3. Role `admin` bypassa o filtro de tenant (acesso cross-tenant)
4. Handlers acessam `req.shopId` para operações tenant-specific

### Testing

- **Testes unitários**: Co-localizados com o código (ex: `slug.test.ts`)
- **Testes de rotas**: Em `src/routes/admin/__tests__/`
- **Property-Based Tests**: fast-check v3.23
- **Framework**: Vitest v2.1 com ambiente Node.js
- **HTTP Testing**: supertest v7.2
- **Comando**: `yarn test` (vitest --run)

### Naming Conventions

- **Routes**: `{entity}.routes.ts`
- **Services**: `{entity}.service.ts`
- **Middlewares**: camelCase (`authMiddleware`, `shopResolver`)
- **Utils**: camelCase (`verifyToken`, `hashPassword`)
- **Types**: PascalCase para interfaces/types
