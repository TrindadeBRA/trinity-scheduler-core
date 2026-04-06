# Product Overview

Trinity Scheduler Core é a API REST backend que serve tanto o painel administrativo quanto a aplicação cliente do sistema de agendamentos para estabelecimentos de beleza, saúde e bem-estar.

## Core Features

### Admin API (`/admin/*`)

Endpoints protegidos por autenticação JWT para usuários administrativos.

#### Autenticação e Usuários

- Login com email e senha — retorna JWT + dados do usuário (name, email, avatar, role)
- Registro de novos estabelecimentos: cria Shop, User (leader), Professional e primeira Unit em transação atômica
  - Gera horários de funcionamento padrão (seg-sab 09:00-18:00, domingo fechado)
  - Gera slug unico para a primeira unidade (a partir do nome do shop ou slug fornecido)
  - Envia email de boas-vindas ao leader (fire-and-forget)
- Reset de senha via token (validade 1 hora) — envia email com link para ADMIN_URL/reset-password
- GET /admin/auth/me — dados do usuario autenticado (inclui phone do profissional vinculado)
- PATCH /admin/auth/profile — atualiza nome, telefone (no profissional vinculado) e/ou senha

#### Dashboard e Analytics

- GET /admin/dashboard/stats?date=YYYY-MM-DD&unitId — receita, contagem de agendamentos, top service, novos clientes do dia
  - Revenue = soma de precos de agendamentos confirmed + completed (em centavos)
  - Professional ve apenas estatisticas dos proprios agendamentos
- GET /admin/dashboard/weekly-revenue?unitId — faturamento da semana atual (seg-dom) agrupado por dia e profissional
- GET /admin/dashboard/weekly-cancelled?unitId — valor cancelado da semana atual agrupado por dia

#### Gestao de Agendamentos

- CRUD completo com paginacao e ordenacao
- Filtros: date, professionalId, status (suporta multiplos separados por virgula), serviceId, clientId, unitId, search (busca textual em cliente/servico/profissional), startDate/endDate
- Ordenacao: date, time, clientName, serviceName, professionalName, status, price, duration
- Professional ve apenas os proprios agendamentos (filtro automatico)
- Status reais no banco: confirmed, cancelled, completed
- Criacao via appointment.service.ts com auto-atribuicao de profissional quando professionalId e null

#### Gestao de Clientes

- CRUD completo com paginacao e ordenacao
- Busca por nome ou telefone
- Ordenacao: name, phone, email, totalSpent, lastVisit, createdAt
- Exclusao real (hard delete) — nao ha soft delete em clientes
- Constraint unica: (shopId, phone) — telefone unico por estabelecimento

#### Gestao de Profissionais (Staff)

- CRUD com paginacao e ordenacao
- Soft delete: deletedAt timestamp (queries sempre filtram deletedAt: null)
- Alocacao em multiplas unidades via tabela ProfessionalUnit (many-to-many)
  - GET/PUT /admin/professionals/:id/units — gerencia alocacoes
  - unitId legado mantido para retrocompatibilidade (aponta para primeira unidade)
- Credenciais de acesso: leader/admin podem criar/atualizar email+senha para profissionais acessarem o painel
  - Servico professionalCredentials.service.ts gerencia criacao/atualizacao
  - Rollback automatico: se criacao de credenciais falhar, o profissional e removido
- Professional so pode ver e editar o proprio registro (verificacao explicita por professionalId)
- Filtro de unidade: busca em unitId legado OU professionalUnits

#### Catalogo de Servicos

- CRUD com paginacao e ordenacao
- Tipos: service (principal) e addon (adicional)
- Preco em centavos (inteiro)
- Filtro por tipo: type=service|addon|all
- Busca por nome ou descricao

#### Multi-Unidade

- CRUD com paginacao e ordenacao
- Slug unico global (constraint @unique no Prisma)
- Geracao automatica de slug a partir do nome se nao fornecido
- Validacao e sanitizacao de slug (lowercase, sem acentos, hifens)
- Lookup case-insensitive para verificar unicidade
- Professional ve apenas unidades as quais esta alocado (via ProfessionalUnit + unitId legado)

#### Relatorios de Receita

- GET /admin/revenue/summary com filtros: unitId, staffId, startDate, endDate
- Retorna: totalRevenue, averageTicket, completedCount, lostRevenue, dailyRevenue, serviceBreakdown, staffRanking (top 5)
- Todos os valores monetarios em centavos
- Professional ve apenas propria receita; staffRanking filtrado para o proprio registro

#### Configuracoes do Estabelecimento

- GET/PUT /admin/shop — dados do estabelecimento (name, phone, email, address, niche, bookingBuffer)
- GET/PUT /admin/shop/hours — horarios de funcionamento (upsert por dia)
- GET /admin/shop/niches — lista nichos disponiveis: barbearia, salao-beleza
- Nichos validos: barbearia e salao-beleza (validacao no backend)

#### Upload de Arquivos

- POST /admin/upload/presign — gera presigned URL para upload direto ao S3/R2
- Content types permitidos: image/jpeg, image/png, image/webp, image/avif
- Folders permitidos: services, professionals, shop
- Retorna: uploadUrl (PUT), publicUrl, key

#### Utilitarios do Sistema

- POST /admin/system/complete-past-appointments — apenas role admin — completa agendamentos confirmed de dias anteriores (execucao manual do cron)

### Client API

Endpoints para a aplicacao cliente. Requerem header X-Shop-Id (exceto /client/units/resolve/:slug).

#### Autenticacao

- POST /auth/login — upsert de cliente por telefone, retorna clientId + name
- GET /auth/validate?clientId= — valida se clientId existe no banco
- PATCH /auth/name — atualiza nome do cliente (clientId + name no body)
- Sem JWT — autenticacao e apenas por clientId armazenado no localStorage do frontend

#### Servicos e Adicionais

- GET /services — servicos ativos (type=service, active=true)
- GET /addons — adicionais ativos (type=addon, active=true)
- Retorna: id, name, duration, price, description, icon, image

#### Profissionais

- GET /professionals?unitId — profissionais ativos (active=true, deletedAt=null)
- Filtro por unidade: busca em unitId legado OU professionalUnits
- Retorna: id, name, avatar, specialties

#### Disponibilidade

- GET /availability/slots?date&professionalId&serviceDuration&unitId
  - Retorna array de { time, available } para a data
  - Sem professionalId: uniao de disponibilidade de todos os profissionais
  - Respeita: horario da loja, horario do profissional, intervalo de almoco, agendamentos existentes, bookingBuffer
  - Timezone: America/Sao_Paulo
- GET /availability/disabled-dates?startDate&endDate&professionalId&unitId
  - Retorna array de datas (YYYY-MM-DD) sem nenhum slot disponivel

#### Agendamentos

- POST /appointments — cria agendamento (auto-atribui profissional se professionalId null)
- GET /appointments?clientId= — lista agendamentos do cliente (desc por date/time)
- PATCH /appointments/:id/cancel — cancela agendamento (body: { reason })

#### Informacoes do Estabelecimento

- GET /client/shop/info?unitId — retorna { name, niche } do shop ou da unidade
- GET /client/units/resolve/:slug — resolve slug para { unitId, shopId, unitName, shopName } (publico, sem X-Shop-Id)

### Public API (/public/*)

- GET /public/niches — lista nichos disponiveis com displayName

## Architecture

### Multi-Tenancy

- Cada Shop e completamente isolado via shopId
- Admin: shopId extraido do JWT pelo authMiddleware
- Client: shopId extraido do header X-Shop-Id pelo shopResolver
- tenantFilter injeta shopId em query params, body e req.shopId
- Role admin bypassa o filtro de tenant (acesso cross-tenant)

### Multi-Unit

- Estabelecimentos tem multiplas unidades fisicas
- Cada unidade tem slug unico global para URL de agendamento
- Profissionais alocados via ProfessionalUnit (many-to-many) + unitId legado
- Disponibilidade calculada por unidade quando unitId fornecido

### Role-Based Access Control (RBAC)

- admin: Acesso completo, cross-tenant
- leader: Acesso completo ao proprio estabelecimento
- professional: Acesso restrito aos proprios dados (agendamentos, receita, perfil)
- Filtro automatico via applyProfessionalFilter() em utils/dataFilter.ts
- Verificacoes explicitas de acesso em endpoints de detalhe/edicao de profissional

### Scheduled Jobs (node-cron)

- initCronJobs() chamado no startup do servidor
- Job principal: completa agendamentos confirmed de dias anteriores (status para completed)

### Appointment Creation Flow

1. Busca servico principal e adicionais
2. Calcula duracao total e preco total (em centavos)
3. Se professionalId null: auto-atribui primeiro profissional disponivel no slot
4. Valida disponibilidade do profissional (via getAvailableSlots)
5. Cria Appointment com AppointmentAddon[] em uma operacao

### Availability Calculation

- Slots gerados a cada 30 minutos alinhados com horario da loja
- Filtros aplicados em ordem: horario do profissional, intervalo de almoco, agendamentos existentes
- Para hoje: remove slots ja passados + bookingBuffer (minutos de antecedencia)
- Timezone: America/Sao_Paulo (constante SHOP_TIMEZONE)

## Database Schema

PostgreSQL com Prisma ORM. Entidades principais:

- Shop: Raiz do multi-tenant (niche: barbearia ou salao-beleza, bookingBuffer em minutos)
- User: Usuarios admin com roles (admin/leader/professional), vinculado opcionalmente a Professional
- Professional: Profissionais com soft delete (deletedAt), alocados em unidades via ProfessionalUnit
- WorkingHour: Horarios de trabalho por dia (com lunchStart/lunchEnd)
- Client: Clientes finais, unique por (shopId, phone)
- Service: Servicos e addons (preco em centavos)
- Appointment: Status: confirmed, cancelled, completed
- AppointmentAddon: Adicionais do agendamento (cascade delete)
- Unit: Unidades fisicas com slug unico global
- ProfessionalUnit: Alocacao many-to-many profissional e unidade
- ShopHour: Horarios de funcionamento por dia (start/end nullable = fechado)

Nota: Nao existe modelo ProfessionalAvailability no schema atual. A disponibilidade e calculada dinamicamente a partir de WorkingHour e Appointment.

## Error Handling

Formato de resposta de erro:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Campo phone e obrigatorio"
}
```

Codigos:
- 400 - VALIDATION_ERROR
- 401 - UNAUTHORIZED
- 403 - FORBIDDEN
- 404 - NOT_FOUND
- 409 - CONFLICT
- 500 - INTERNAL_ERROR

## Language

Codigo e mensagens de erro em portugues (Brasil).
