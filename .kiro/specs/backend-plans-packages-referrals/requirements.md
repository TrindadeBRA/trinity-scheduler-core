# Documento de Requisitos — Backend: Planos, Pacotes e Referências

## Introdução

Este documento especifica os requisitos do backend (trinity-scheduler-core) para suportar a feature de pacotes mensais, sistema de referências e CRUD de referências já implementada no frontend (trinity-scheduler-admin). O backend é uma aplicação Express.js + Prisma + PostgreSQL com integração Asaas existente para assinaturas recorrentes. As alterações incluem: (1) novos campos no modelo Plan e UserPlan para suportar pacotes de 30 dias; (2) endpoint de compra de pacote via Asaas Payments API; (3) cron job de expiração de pacotes; (4) atualização do webhook para pagamentos de pacote; (5) modelo Referral com CRUD completo; (6) associação de referência no registro de usuários.

## Glossário

- **Backend**: A aplicação trinity-scheduler-core (Express.js + Prisma + PostgreSQL).
- **Plan**: Modelo Prisma que define um nível de serviço (FREE, PREMIUM, PRO, ADMIN) com preço, limites e agora preço de pacote.
- **UserPlan**: Modelo Prisma que associa um User a um Plan, com status de assinatura e agora campos de pacote.
- **Monthly_Package**: Pagamento avulso de 30 dias criado via Asaas Payments API (POST /v3/payments), sem renovação automática.
- **Package_Price**: Campo `packagePrice` no modelo Plan, armazenado em centavos, representando o preço do pacote mensal.
- **Billing_Type**: Método de pagamento para pacotes: "BOLETO", "CREDIT_CARD" ou "PIX".
- **Asaas_Payments_API**: Endpoint POST /v3/payments do Asaas para criar cobranças avulsas (diferente de /v3/subscriptions para recorrência).
- **Asaas_Customers_API**: Endpoint POST /v3/customers do Asaas para criar ou buscar clientes.
- **External_Reference**: String no formato `kronuz:package:{userId}:{planId}` usada para identificar pagamentos de pacote nos webhooks.
- **Referral**: Novo modelo Prisma que representa um código de referência com tipo e valor de comissão.
- **Ref_Code**: Campo `code` do Referral, string única e case-insensitive.
- **Commission_Type**: Tipo de comissão de um Referral: "percentage" (%) ou "fixed" (centavos).
- **Cron_Service**: Serviço existente (`cron.service.ts`) que executa rotinas diárias às 00:00 (America/Sao_Paulo).
- **Webhook_Handler**: Endpoint POST /billing/webhook que recebe eventos do Asaas e atualiza o UserPlan.
- **asaasRequest**: Função helper existente em `billing.routes.ts` que faz chamadas autenticadas à API do Asaas.
- **tenantFilter**: Middleware que injeta `shopId` nas queries para isolamento multi-tenant — NÃO deve ser usado para Referrals (são globais).
- **parsePagination**: Utilitário existente que extrai page/pageSize de query params e retorna skip/take.
- **createPaginatedResponse**: Utilitário existente que formata resposta paginada com data, total, page, pageSize, totalPages.

## Requisitos

### Requisito 1: Campo packagePrice no modelo Plan

**História do Usuário:** Como desenvolvedor do frontend, quero que o modelo Plan inclua um campo packagePrice, para que o admin possa configurar preços de pacote separados dos preços de assinatura.

#### Critérios de Aceitação

1. O modelo Plan no Prisma DEVE incluir um campo `packagePrice` do tipo `Int` com valor padrão `0`.
2. QUANDO o endpoint GET /admin/plans retornar a lista de planos, O Backend DEVE incluir o campo `packagePrice` em cada objeto Plan.
3. QUANDO o endpoint GET /plans retornar a lista de planos, O Backend DEVE incluir o campo `packagePrice` em cada objeto Plan.
4. QUANDO o endpoint PATCH /admin/plans/:planId receber `packagePrice` no corpo da requisição, O Backend DEVE atualizar o campo `packagePrice` do plano especificado.
5. O seed de dados DEVE incluir valores de `packagePrice` para cada plano (FREE: 0, PREMIUM: 3999, PRO: 12999, ADMIN: 0).

### Requisito 2: Campos de pacote no modelo UserPlan

**História do Usuário:** Como desenvolvedor do frontend, quero que o modelo UserPlan inclua campos para identificar pacotes e sua expiração, para que o frontend possa exibir o status do pacote.

#### Critérios de Aceitação

1. O modelo UserPlan no Prisma DEVE incluir um campo `isPackage` do tipo `Boolean` com valor padrão `false`.
2. O modelo UserPlan no Prisma DEVE incluir um campo `packageExpiresAt` do tipo `DateTime?` (nullable).
3. QUANDO o endpoint GET /plans/me retornar o plano do usuário, O Backend DEVE incluir os campos `isPackage` e `packageExpiresAt` na resposta.

### Requisito 3: Endpoint de compra de pacote (POST /billing/package)

**História do Usuário:** Como Leader, quero comprar um pacote mensal de 30 dias via boleto, PIX ou cartão de crédito, para ter opções flexíveis de pagamento.

#### Critérios de Aceitação

1. O Backend DEVE expor um endpoint POST /billing/package protegido por authMiddleware e authorize('leader', 'admin').
2. QUANDO o endpoint POST /billing/package receber uma requisição válida, O Backend DEVE criar um cliente no Asaas via POST /v3/customers com os dados pessoais fornecidos (name, cpfCnpj, email, phone, postalCode).
3. QUANDO o cliente Asaas for criado, O Backend DEVE criar um pagamento avulso via POST /v3/payments com: customer (ID do Asaas), billingType, value (packagePrice do plano dividido por 100), dueDate (data atual no formato YYYY-MM-DD, timezone America/Sao_Paulo), description ("Pacote 30 dias - {planId}"), externalReference ("kronuz:package:{userId}:{planId}").
4. QUANDO o billingType for "CREDIT_CARD", O Backend DEVE incluir os objetos creditCard e creditCardHolderInfo no payload do pagamento Asaas, com os campos sanitizados (remoção de caracteres não-numéricos de number, cpfCnpj, postalCode).
5. QUANDO o billingType for "BOLETO" ou "PIX", O Backend DEVE criar o pagamento sem os objetos creditCard e creditCardHolderInfo.
6. QUANDO o pagamento Asaas for criado, O Backend DEVE fazer upsert no UserPlan com: planId, isPackage=true, packageExpiresAt=data atual + 30 dias, subscriptionStatus="ACTIVE".
7. QUANDO o pagamento for criado, O Backend DEVE retornar status 200 com `{ paymentId: string }`.
8. SE o planId fornecido não existir, ENTÃO O Backend DEVE retornar status 404 com mensagem "Plano não encontrado".
9. SE a API do Asaas retornar erro, ENTÃO O Backend DEVE retornar status 502 com a mensagem de erro do Asaas.
10. SE campos obrigatórios estiverem ausentes (planId, billingType, name, cpfCnpj, email, phone, postalCode, addressNumber), ENTÃO O Backend DEVE retornar status 400 com mensagem indicando o campo ausente.
11. QUANDO o billingType for "CREDIT_CARD" e campos de cartão estiverem ausentes, O Backend DEVE retornar status 400 com mensagem indicando o campo ausente.

### Requisito 4: Cron job de expiração de pacotes

**História do Usuário:** Como operador da plataforma, quero que pacotes expirados sejam automaticamente revertidos para o plano FREE, para que usuários não mantenham acesso após o vencimento.

#### Critérios de Aceitação

1. O Cron_Service DEVE incluir uma função `expirePackages` que busca todos os UserPlans onde `isPackage` é `true` e `packageExpiresAt` é anterior à data/hora atual.
2. QUANDO pacotes expirados forem encontrados, A função `expirePackages` DEVE atualizar cada UserPlan com: planId="FREE", isPackage=false, packageExpiresAt=null, subscriptionStatus="TRIAL".
3. A função `expirePackages` DEVE ser executada na rotina diária existente (cron às 00:00 America/Sao_Paulo), junto com as funções `completePastAppointments` e `syncClientTotals`.
4. A função `expirePackages` DEVE registrar no console a quantidade de pacotes expirados processados.

### Requisito 5: Webhook para pagamentos de pacote

**História do Usuário:** Como operador da plataforma, quero que o webhook do Asaas processe eventos de pagamento de pacote, para que o status do UserPlan seja atualizado automaticamente.

#### Critérios de Aceitação

1. QUANDO o Webhook_Handler receber um evento PAYMENT_CONFIRMED com externalReference no formato "kronuz:package:{userId}:{planId}", O Backend DEVE atualizar o UserPlan do userId com: planId, isPackage=true, packageExpiresAt=data atual + 30 dias, subscriptionStatus="ACTIVE".
2. QUANDO o Webhook_Handler receber um evento PAYMENT_OVERDUE com externalReference no formato "kronuz:package:{userId}:{planId}", O Backend DEVE atualizar o UserPlan do userId com: subscriptionStatus="INACTIVE".
3. O Webhook_Handler DEVE distinguir entre pagamentos de pacote (externalReference contém "package") e pagamentos de assinatura (externalReference sem "package") para aplicar a lógica correta.
4. O Webhook_Handler DEVE retornar status 200 para todos os eventos processados, independente de sucesso ou falha no processamento interno.

### Requisito 6: Modelo Referral no Prisma

**História do Usuário:** Como desenvolvedor, quero um modelo Referral no banco de dados, para armazenar códigos de referência e suas configurações de comissão.

#### Critérios de Aceitação

1. O modelo Referral no Prisma DEVE incluir os campos: id (String, UUID, PK), code (String, unique), commissionType (String — "percentage" ou "fixed"), commissionValue (Int — centavos para fixed, inteiro para percentage), createdAt (DateTime), updatedAt (DateTime).
2. O campo `code` do Referral DEVE ter uma constraint unique no banco de dados.
3. O modelo Referral DEVE incluir uma relação com User (um Referral pode ter muitos Users associados).

### Requisito 7: CRUD de Referências — endpoints admin

**História do Usuário:** Como Admin, quero endpoints para gerenciar códigos de referência, para configurar o programa de referências.

#### Critérios de Aceitação

1. O Backend DEVE expor um endpoint GET /admin/referrals protegido por authMiddleware e authorize('admin'), sem tenantFilter.
2. QUANDO o endpoint GET /admin/referrals receber um parâmetro de query `search`, O Backend DEVE filtrar referências cujo campo `code` contenha o valor de busca (case-insensitive).
3. O endpoint GET /admin/referrals DEVE retornar uma resposta paginada usando parsePagination e createPaginatedResponse, ordenada por `createdAt` descendente.
4. O Backend DEVE expor um endpoint GET /admin/referrals/:id protegido por authMiddleware e authorize('admin'), que retorna uma referência pelo ID.
5. SE a referência com o ID fornecido não existir, ENTÃO O endpoint GET /admin/referrals/:id DEVE retornar status 404 com mensagem "Referência não encontrada".
6. O Backend DEVE expor um endpoint POST /admin/referrals protegido por authMiddleware e authorize('admin'), que cria uma nova referência com os campos code, commissionType e commissionValue.
7. QUANDO o endpoint POST /admin/referrals receber um code que já existe (case-insensitive), O Backend DEVE retornar status 409 com mensagem "Código já existe".
8. O Backend DEVE expor um endpoint PUT /admin/referrals/:id protegido por authMiddleware e authorize('admin'), que atualiza uma referência existente.
9. QUANDO o endpoint PUT /admin/referrals/:id receber um code que já existe em outra referência (case-insensitive), O Backend DEVE retornar status 409 com mensagem "Código já existe".
10. O Backend DEVE expor um endpoint DELETE /admin/referrals/:id protegido por authMiddleware e authorize('admin'), que exclui uma referência pelo ID.
11. SE a referência com o ID fornecido não existir nos endpoints PUT ou DELETE, ENTÃO O Backend DEVE retornar status 404 com mensagem "Referência não encontrada".
12. O endpoint POST /admin/referrals DEVE armazenar o campo `code` em lowercase para garantir tratamento case-insensitive.

### Requisito 8: Campo referralId no modelo User e associação no registro

**História do Usuário:** Como operador da plataforma, quero que novos usuários sejam associados ao código de referência usado no cadastro, para rastrear a origem dos registros.

#### Critérios de Aceitação

1. O modelo User no Prisma DEVE incluir um campo opcional `referralId` do tipo `String?` com relação ao modelo Referral.
2. QUANDO o endpoint POST /admin/auth/register receber um campo `ref` no corpo da requisição, O Backend DEVE buscar um Referral cujo `code` corresponda ao valor de `ref` (case-insensitive).
3. QUANDO um Referral correspondente for encontrado, O Backend DEVE associar o `referralId` ao User criado na transação de registro.
4. QUANDO nenhum Referral correspondente for encontrado para o `ref` fornecido, O Backend DEVE prosseguir com o registro normalmente sem associar referralId (sem erro).
5. QUANDO o campo `ref` não for fornecido no corpo da requisição, O Backend DEVE prosseguir com o registro normalmente sem associar referralId.

### Requisito 9: Documentação Swagger dos novos endpoints

**História do Usuário:** Como desenvolvedor, quero que os novos endpoints tenham documentação Swagger, para facilitar a integração e testes.

#### Critérios de Aceitação

1. O endpoint POST /billing/package DEVE ter anotação Swagger JSDoc com tags, summary, security, requestBody e responses documentados.
2. Os endpoints GET, POST, PUT, DELETE de /admin/referrals DEVE ter anotações Swagger JSDoc com tags, summary, security, parameters e responses documentados.
3. O endpoint GET /admin/referrals/:id DEVE ter anotação Swagger JSDoc documentada.
