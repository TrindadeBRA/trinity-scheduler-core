# Plano de Implementação: Backend — Planos, Pacotes e Referências

## Visão Geral

Implementação incremental das alterações no backend para suportar pacotes mensais (pagamento avulso via Asaas), expiração automática via cron, atualização do webhook, CRUD de referências e associação de referência no registro. Cada tarefa constrói sobre a anterior, garantindo que não haja código órfão.

## Tarefas

- [x] 1. Alterações no Prisma Schema e migração
  - [x] 1.1 Adicionar `packagePrice Int @default(0)` ao modelo `Plan` em `prisma/schema.prisma`
    - _Requisitos: 1.1_
  - [x] 1.2 Adicionar `isPackage Boolean @default(false)` e `packageExpiresAt DateTime?` ao modelo `UserPlan` em `prisma/schema.prisma`
    - _Requisitos: 2.1, 2.2_
  - [x] 1.3 Criar modelo `Referral` com campos `id`, `code` (unique), `commissionType`, `commissionValue`, `createdAt`, `updatedAt` e relação `users User[]` em `prisma/schema.prisma`
    - _Requisitos: 6.1, 6.2, 6.3_
  - [x] 1.4 Adicionar campo opcional `referralId String?` ao modelo `User` com relação `referral Referral?` em `prisma/schema.prisma`
    - _Requisitos: 8.1_
  - [x] 1.5 Gerar e aplicar a migração Prisma (`npx prisma migrate dev --name add-packages-referrals`)
    - _Requisitos: 1.1, 2.1, 2.2, 6.1, 6.2, 6.3, 8.1_

- [x] 2. Atualizar seed de dados
  - [x] 2.1 Adicionar campo `packagePrice` ao array `PLANS` em `prisma/seed/data.ts` (FREE: 0, PREMIUM: 3999, PRO: 12999, ADMIN: 0)
    - _Requisitos: 1.5_
  - [x] 2.2 Atualizar o upsert de planos em `prisma/seed.ts` para incluir `packagePrice` no `update` (garantir que re-seed atualize o campo)
    - _Requisitos: 1.5_

- [x] 3. Atualizar rotas de planos
  - [x] 3.1 Aceitar `packagePrice` no body do PATCH `/admin/plans/:planId` em `src/routes/admin/plans.routes.ts`
    - _Requisitos: 1.4_
  - [x] 3.2 Incluir `isPackage` e `packageExpiresAt` na resposta do GET `/plans/me` em `src/routes/admin/plans.routes.ts`
    - _Requisitos: 2.3_

- [x] 4. Funções auxiliares de externalReference e endpoint POST /billing/package
  - [x] 4.1 Criar funções `buildPackageExternalReference(userId, planId)` e `parseExternalReference(ref)` em `src/routes/billing.routes.ts`
    - `buildPackageExternalReference` retorna `kronuz:package:{userId}:{planId}`
    - `parseExternalReference` faz split e retorna `{ isPackage, userId, planId }` ou `null`
    - _Requisitos: 5.1, 5.3_
  - [ ]* 4.2 Escrever teste de propriedade para round-trip do externalReference
    - **Propriedade 1: Round-trip de parsing do externalReference**
    - **Valida: Requisitos 5.1, 5.3**
  - [x] 4.3 Implementar endpoint POST `/billing/package` em `src/routes/billing.routes.ts`
    - Proteger com `authMiddleware` + `authorize('leader', 'admin')`
    - Validar campos obrigatórios (planId, billingType, name, cpfCnpj, email, phone, postalCode, addressNumber)
    - Validar creditCard/creditCardHolderInfo quando billingType === "CREDIT_CARD"
    - Buscar Plan por planId (404 se não existe)
    - Criar customer no Asaas via POST /v3/customers
    - Criar pagamento via POST /v3/payments com externalReference de pacote
    - Upsert UserPlan com isPackage=true, packageExpiresAt=now+30d, subscriptionStatus='ACTIVE'
    - Retornar `{ paymentId }`
    - Adicionar anotação Swagger JSDoc
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 9.1_
  - [ ]* 4.4 Escrever teste de propriedade para validação de campos obrigatórios do POST /billing/package
    - **Propriedade 8: Validação de campos obrigatórios no POST /billing/package**
    - **Valida: Requisito 3.10**

- [x] 5. Atualizar webhook para distinguir pacote vs assinatura
  - [x] 5.1 Refatorar handler POST `/billing/webhook` em `src/routes/billing.routes.ts` para usar `parseExternalReference`
    - Se `isPackage=true` + PAYMENT_CONFIRMED: updateMany com planId, isPackage=true, packageExpiresAt=now+30d, subscriptionStatus='ACTIVE'
    - Se `isPackage=true` + PAYMENT_OVERDUE: updateMany com subscriptionStatus='INACTIVE'
    - Se `isPackage=false`: manter fluxo existente de assinatura
    - Sempre retornar 200
    - _Requisitos: 5.1, 5.2, 5.3, 5.4_
  - [ ]* 5.2 Escrever teste de propriedade para webhook sempre retornar 200
    - **Propriedade 2: Webhook sempre retorna 200**
    - **Valida: Requisito 5.4**

- [x] 6. Cron job de expiração de pacotes
  - [x] 6.1 Criar função `expirePackages` em `src/services/cron.service.ts`
    - Buscar UserPlans com isPackage=true e packageExpiresAt < now
    - Atualizar para planId='FREE', isPackage=false, packageExpiresAt=null, subscriptionStatus='TRIAL'
    - Logar quantidade de pacotes expirados no console
    - _Requisitos: 4.1, 4.2, 4.4_
  - [x] 6.2 Adicionar chamada a `expirePackages` dentro do `initCronJobs` em `src/services/cron.service.ts`, junto com `completePastAppointments` e `syncClientTotals`
    - _Requisitos: 4.3_
  - [ ]* 6.3 Escrever teste de propriedade para expirePackages
    - **Propriedade 3: expirePackages reseta apenas pacotes expirados**
    - **Valida: Requisitos 4.1, 4.2**

- [x] 7. Checkpoint — Verificar fluxo de pacotes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. CRUD de Referências
  - [x] 8.1 Criar arquivo `src/routes/admin/referrals.routes.ts` com endpoints:
    - GET `/referrals` — listagem paginada com busca case-insensitive por `code`, usando `parsePagination` e `createPaginatedResponse`, ordenado por `createdAt desc`
    - GET `/referrals/:id` — busca por ID (404 se não encontrado)
    - POST `/referrals` — criação com code em lowercase, commissionType, commissionValue (409 se code duplicado)
    - PUT `/referrals/:id` — atualização (404 se não encontrado, 409 se code duplicado em outra referência)
    - DELETE `/referrals/:id` — exclusão (404 se não encontrado, 204 no sucesso)
    - Proteger todos com `authMiddleware` + `authorize('admin')`, sem `tenantFilter`
    - Adicionar anotações Swagger JSDoc em todos os endpoints
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 9.2, 9.3_
  - [ ]* 8.2 Escrever teste de propriedade para lowercase e unicidade case-insensitive do code
    - **Propriedade 4: Referral code — lowercase e unicidade case-insensitive**
    - **Valida: Requisitos 7.7, 7.9, 7.12**
  - [ ]* 8.3 Escrever teste de propriedade para busca case-insensitive de referências
    - **Propriedade 5: Busca de referências por code é case-insensitive**
    - **Valida: Requisito 7.2**
  - [ ]* 8.4 Escrever teste de propriedade para paginação de referências
    - **Propriedade 6: Paginação de referências respeita limites**
    - **Valida: Requisito 7.3**

- [x] 9. Montar rotas de referências no index
  - [x] 9.1 Importar `adminReferralsRouter` em `src/routes/index.ts` e montar em `/admin` com `authMiddleware` (sem `tenantFilter`)
    - _Requisitos: 7.1_

- [x] 10. Atualizar registro para aceitar campo ref
  - [x] 10.1 Modificar POST `/admin/auth/register` em `src/routes/admin/auth.routes.ts` para:
    - Extrair campo opcional `ref` do body
    - Se `ref` fornecido: buscar `prisma.referral.findFirst({ where: { code: ref.toLowerCase() } })`
    - Se encontrado: incluir `referralId` no `prisma.user.create()` dentro da transação
    - Se não encontrado ou não fornecido: prosseguir normalmente
    - _Requisitos: 8.2, 8.3, 8.4, 8.5_
  - [ ]* 10.2 Escrever teste de propriedade para registro com ref case-insensitive
    - **Propriedade 7: Registro com ref — busca case-insensitive**
    - **Valida: Requisitos 8.2, 8.3**

- [x] 11. Checkpoint — Verificar fluxo de referências
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Checkpoint final
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que todos os endpoints novos estão documentados com Swagger JSDoc
  - Verificar que a migração Prisma está consistente com o schema

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude
- Todos os arquivos estão no diretório `trinity-scheduler-core/`
