# Implementation Plan: direct-subscription-billing

## Overview

Substituição do fluxo de Checkout Session do Asaas por criação direta de customer + subscription via API Asaas v3. Abrange: novo endpoint `POST /billing/subscribe`, remoção do endpoint legado `POST /billing/checkout`, simplificação do webhook handler, limpeza do `.env.example` e nova tela de assinatura no frontend.

## Tasks

- [x] 1. Implementar o endpoint `POST /billing/subscribe` em `billing.routes.ts`
  - [x] 1.1 Adicionar validação dos campos obrigatórios (`planId`, `name`, `cpfCnpj`, `email`, `phone`, `postalCode`, `addressNumber`, `remoteIp`, `creditCard.*`, `creditCardHolderInfo.*`) retornando 400 `VALIDATION_ERROR` se ausentes
    - Não logar `creditCard.number`, `creditCard.ccv` nem dados sensíveis do titular nos logs
    - _Requirements: 6.3, 6.4, 6.5, 6.6_
  - [x] 1.2 Buscar o plano no banco via `prisma.plan.findUnique` e retornar 404 `NOT_FOUND` se não encontrado
    - _Requirements: 1.3_
  - [x] 1.3 Chamar `POST /v3/customers` na API Asaas com os dados do usuário; retornar 502 `ASAAS_ERROR` em caso de falha
    - _Requirements: 1.1, 1.4_
  - [x] 1.4 Chamar `POST /v3/subscriptions/` (com barra — endpoint específico para cartão de crédito) com `billingType: 'CREDIT_CARD'`, `cycle: 'MONTHLY'`, `nextDueDate` (data atual em `America/Sao_Paulo`), `externalReference: kronuz:{userId}:{planId}`, `creditCard`, `creditCardHolderInfo` e `remoteIp`; retornar 502 `ASAAS_ERROR` em caso de falha
    - _Requirements: 1.1, 1.5, 1.6, 1.9, 1.10_
  - [x] 1.5 Fazer upsert do `UserPlan` com `subscriptionId`, `planId` e `subscriptionStatus: 'ACTIVE'` após criação bem-sucedida da subscription; retornar 200 `{ subscriptionId }`
    - _Requirements: 1.7, 1.8_
  - [ ]* 1.6 Escrever testes unitários para o endpoint `POST /billing/subscribe`
    - Cobrir: sem JWT → 401, role `professional` → 403, body sem `planId` → 400, sem `cpfCnpj` → 400, sem `creditCard` → 400, sem `remoteIp` → 400, `planId` inexistente → 404, falha no customer Asaas → 502, falha na subscription Asaas → 502, fluxo completo → 200 `{ subscriptionId }`
    - Localização: `src/routes/__tests__/billing.subscribe.test.ts`
    - _Requirements: 1.1–1.10, 6.1–6.5_

- [ ] 2. Escrever property-based tests para o endpoint `POST /billing/subscribe`
  - [ ]* 2.1 Escrever property test para falha na API Asaas retorna 502
    - **Property 1: Falha na API Asaas retorna 502**
    - **Validates: Requirements 1.4, 1.5**
    - Localização: `src/routes/__tests__/billing.subscribe.pbt.test.ts`
  - [ ]* 2.2 Escrever property test para formato do externalReference
    - **Property 2: Formato do externalReference**
    - **Validates: Requirements 1.6**
    - Extrair função `buildExternalReference(userId, planId)` para facilitar o teste
  - [ ]* 2.3 Escrever property test para planId inválido retorna 404
    - **Property 4: planId inválido retorna 404**
    - **Validates: Requirements 1.3**
  - [ ]* 2.4 Escrever property test para autenticação obrigatória
    - **Property 8: Autenticação obrigatória no subscribe**
    - **Validates: Requirements 6.1**
  - [ ]* 2.5 Escrever property test para autorização por role
    - **Property 9: Autorização por role no subscribe**
    - **Validates: Requirements 6.2**

- [x] 3. Checkpoint — Garantir que todos os testes do endpoint subscribe passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 4. Remover o endpoint legado `POST /billing/checkout` de `billing.routes.ts`
  - Remover completamente o handler `router.post('/checkout', ...)` e seus comentários JSDoc/Swagger
  - _Requirements: 2.1, 2.2, 2.3_
  - [ ]* 4.1 Escrever teste unitário confirmando que `POST /billing/checkout` retorna 404
    - _Requirements: 2.2_

- [x] 5. Simplificar o webhook handler em `billing.routes.ts`
  - [x] 5.1 Remover o bloco de fallback que faz `GET /subscriptions/{subscriptionId}` na API Asaas
    - _Requirements: 3.1_
  - [x] 5.2 Atualizar o parsing do `externalReference` para o formato `kronuz:{userId}:{planId}` usando `split(':', 3)`; logar aviso e retornar 200 se o prefixo for inválido
    - _Requirements: 3.2, 3.3_
  - [x] 5.3 Atualizar o handler do evento `PAYMENT_CONFIRMED` para incluir `planId` no `updateMany` do `UserPlan`
    - _Requirements: 3.3_
  - [ ]* 5.4 Escrever testes unitários para o webhook handler simplificado
    - Cobrir: `externalReference` ausente → 200 sem update, sem prefixo `kronuz:` → 200 sem update, `PAYMENT_CONFIRMED` válido → UserPlan atualizado com `planId`, `SUBSCRIPTION_DELETED` → status `INACTIVE`
    - _Requirements: 3.1–3.4_

- [ ] 6. Escrever property-based tests para o webhook handler
  - [ ]* 6.1 Escrever property test para webhook com externalReference inválido retorna 200 sem processar
    - **Property 5: Webhook com externalReference inválido retorna 200 sem processar**
    - **Validates: Requirements 3.1, 3.2**
    - Localização: `src/routes/__tests__/billing.subscribe.pbt.test.ts`
  - [ ]* 6.2 Escrever property test para parsing do externalReference no webhook
    - **Property 6: Parsing do externalReference**
    - **Validates: Requirements 3.3**
  - [ ]* 6.3 Escrever property test para webhook sempre retorna 200
    - **Property 7: Webhook sempre retorna 200**
    - **Validates: Requirements 3.4**

- [x] 7. Atualizar o `.env.example` do trinity-scheduler-core
  - Remover a variável `ASAAS_BASE_URL`
  - Adicionar `ASAAS_WEBHOOK_TOKEN` com comentário explicativo
  - Manter `ASAAS_API_KEY` sem alteração
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 8. Atualizar tipos e serviço de billing no frontend (`trinity-scheduler-admin`)
  - [x] 8.1 Atualizar `src/types/plans.ts`: remover `CheckoutPayload`/`CheckoutResponse`, adicionar `SubscribePayload` com todos os campos do novo endpoint (incluindo `creditCard`, `creditCardHolderInfo`, `remoteIp`, `postalCode`, `addressNumber`) e `SubscribeResponse { subscriptionId: string }`
    - _Requirements: 1.2_
  - [x] 8.2 Atualizar `src/services/billingService.ts`: remover `createCheckout`, adicionar `subscribe(payload: SubscribePayload): Promise<SubscribeResponse>` chamando `POST /billing/subscribe`
    - _Requirements: 1.1_
  - [x] 8.3 Adicionar utilitário `src/utils/cpfCnpj.ts` com função `validateCpfCnpj(value: string): boolean` que valida 11 dígitos (CPF) ou 14 dígitos (CNPJ) após strip de formatação
    - _Requirements: 5.6, 5.7_

- [x] 9. Criar o modal de assinatura `src/components/SubscribeModal.tsx` no `trinity-scheduler-admin`
  - [x] 9.1 Criar o componente modal usando `@radix-ui/react-dialog` com header (nome do plano + preço), body (formulário em duas seções) e footer (botões Cancelar e Confirmar)
    - _Requirements: 5.1, 5.4_
  - [x] 9.2 Implementar seção "Dados pessoais" com campos `name`, `email`, `phone` (obrigatório), `cpfCnpj`, `postalCode` (obrigatório), `addressNumber` (obrigatório) — pré-preencher `name` e `email` do `useUserStore` e `phone` do perfil do usuário autenticado
    - _Requirements: 5.2, 5.3_
  - [x] 9.3 Implementar seção "Dados do cartão" com campos: número do cartão, nome no cartão, mês de validade, ano de validade e CVV — sem SDK Asaas, dados enviados diretamente ao backend via HTTPS
    - _Requirements: 5.5_
  - [x] 9.4 Implementar captura do `remoteIp` do cliente antes de submeter (ex: `fetch('https://api.ipify.org?format=json')`) e incluir no payload
    - _Requirements: 1.2_
  - [x] 9.5 Implementar validação de `cpfCnpj` usando `validateCpfCnpj` antes de submeter; exibir erro inline se inválido
    - _Requirements: 5.6, 5.7_
  - [x] 9.6 Implementar fluxo de submissão: capturar remoteIp → chamar `billingService.subscribe` → fechar modal e exibir toast de sucesso; em caso de erro exibir mensagem dentro do modal sem limpar campos
    - _Requirements: 5.8, 5.9, 5.10, 5.11_
  - [x] 9.7 Bloquear fechamento do modal durante loading; permitir fechar via botão ×, "Cancelar" ou clique no backdrop quando não está carregando
    - _Requirements: 5.12_

- [x] 10. Integrar o `SubscribeModal` na `PlansTab` (`trinity-scheduler-admin`)
  - Substituir a chamada `billingService.createCheckout` + `window.location.href` pelo `SubscribeModal` no `handleSubscribe` de `src/pages/profile/PlansTab.tsx`
  - Ao clicar em "Assinar" em um plano pago, abrir o modal com o plano selecionado em vez de redirecionar
  - Após sucesso no modal, invalidar a query `user-plan` e exibir toast de confirmação
  - _Requirements: 5.1, 5.10_

- [x] 11. Checkpoint final — Garantir que todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

## Notes

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Tasks 1–7: `trinity-scheduler-core` (backend)
- Tasks 8–11: `trinity-scheduler-admin` (frontend React + Vite + shadcn/ui)
- Property tests usam fast-check v3.23 com mínimo de 100 iterações por propriedade
- Testes de rota usam supertest v7.2 com mocks do Prisma e da função `asaasRequest`
- O `externalReference` no formato `kronuz:{userId}:{planId}` é a mudança central que elimina o fallback de lookup
- O modal usa `@radix-ui/react-dialog` já disponível no projeto admin
