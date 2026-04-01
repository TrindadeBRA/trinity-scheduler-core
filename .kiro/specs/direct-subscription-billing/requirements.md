# Requirements Document

## Introduction

Esta feature substitui o fluxo de assinatura baseado em Checkout Session do Asaas por um fluxo direto de criação de customer + subscription via API do Asaas. O objetivo é eliminar o redirecionamento para uma página externa, coletar os dados necessários diretamente no frontend do Kronuz e garantir que o `externalReference` da subscription seja sempre `kronuz:{userId}:{planId}` — sem fallbacks de lookup posterior.

A mudança abrange três componentes:
1. **Frontend**: nova tela de assinatura com formulário de coleta de dados e tokenização de cartão via SDK Asaas
2. **Backend (trinity-scheduler-core)**: novo endpoint `POST /billing/subscribe` que cria customer e subscription diretamente na API do Asaas
3. **Backend (trinity-scheduler-core)**: simplificação do webhook handler removendo o bloco de fallback de lookup de subscription

## Glossary

- **Subscription_Flow**: Fluxo completo de criação de assinatura recorrente mensal via cartão de crédito
- **Subscribe_Endpoint**: Endpoint `POST /billing/subscribe` no trinity-scheduler-core
- **Checkout_Endpoint**: Endpoint legado `POST /billing/checkout` a ser removido
- **Webhook_Handler**: Handler do endpoint `POST /billing/webhook` no billing.routes.ts
- **Asaas_Customer**: Entidade de cliente criada na API do Asaas via `POST /v3/customers`
- **Asaas_Subscription**: Assinatura recorrente criada na API do Asaas via `POST /v3/subscriptions`
- **Card_Token**: Token de cartão de crédito gerado pelo backend via API Asaas após receber os dados brutos do cartão do frontend via HTTPS
- **ExternalReference**: Campo `externalReference` da Asaas_Subscription, sempre no formato `kronuz:{userId}:{planId}`, permitindo identificar o usuário e o plano contratado diretamente no webhook
- **UserPlan**: Modelo Prisma que armazena o plano e status de assinatura do usuário
- **CpfCnpj**: CPF (11 dígitos) ou CNPJ (14 dígitos) do titular da assinatura, obrigatório pela API do Asaas
- **Subscription_Screen**: Modal de assinatura exibido ao selecionar um plano, com formulário de coleta de dados e confirmação
- **Professional**: Modelo Prisma vinculado ao User via `professionalId`, contém o campo `phone`

---

## Requirements

### Requirement 1: Novo endpoint de assinatura direta

**User Story:** Como líder de estabelecimento, quero assinar um plano diretamente na plataforma sem ser redirecionado para uma página externa, para que o processo de assinatura seja mais fluido e confiável.

#### Acceptance Criteria

1. WHEN uma requisição `POST /billing/subscribe` é recebida com JWT válido de role `leader` ou `admin`, THE Subscribe_Endpoint SHALL criar um Asaas_Customer e uma Asaas_Subscription em sequência
2. THE Subscribe_Endpoint SHALL aceitar no corpo da requisição os campos: `planId` (string, obrigatório), `name` (string, obrigatório), `cpfCnpj` (string, obrigatório), `email` (string, obrigatório), `phone` (string, obrigatório), `postalCode` (string, obrigatório), `addressNumber` (string, obrigatório), `remoteIp` (string, obrigatório — IP do cliente), `creditCard` (objeto obrigatório com `holderName`, `number`, `expiryMonth`, `expiryYear`, `ccv`), `creditCardHolderInfo` (objeto obrigatório com `name`, `email`, `cpfCnpj`, `postalCode`, `addressNumber`, `phone`)
3. WHEN o `planId` fornecido não existe no banco de dados, THE Subscribe_Endpoint SHALL retornar HTTP 404 com `error: "NOT_FOUND"` e `message: "Plano não encontrado"`
4. WHEN a criação do Asaas_Customer falha, THE Subscribe_Endpoint SHALL retornar HTTP 502 com `error: "ASAAS_ERROR"` e a mensagem de erro retornada pela API do Asaas
5. WHEN a criação da Asaas_Subscription falha após o Asaas_Customer ter sido criado, THE Subscribe_Endpoint SHALL retornar HTTP 502 com `error: "ASAAS_ERROR"` e a mensagem de erro retornada pela API do Asaas
6. WHEN a Asaas_Subscription é criada com sucesso, THE Subscribe_Endpoint SHALL definir o campo `externalReference` da subscription como `kronuz:{userId}:{planId}` onde `userId` é o ID do usuário autenticado extraído do JWT e `planId` é o plano selecionado
7. WHEN a Asaas_Subscription é criada com sucesso, THE Subscribe_Endpoint SHALL atualizar o registro `UserPlan` do usuário com o `subscriptionId` retornado pelo Asaas e definir `subscriptionStatus` como `ACTIVE`
8. WHEN a Asaas_Subscription é criada com sucesso, THE Subscribe_Endpoint SHALL retornar HTTP 200 com `{ subscriptionId: string }`
9. THE Subscribe_Endpoint SHALL criar a Asaas_Subscription com `billingType: "CREDIT_CARD"`, `cycle: "MONTHLY"` e `nextDueDate` igual à data atual no fuso horário `America/Sao_Paulo` no formato `YYYY-MM-DD`
10. THE Subscribe_Endpoint SHALL enviar os dados brutos do cartão (`creditCard`) e `creditCardHolderInfo` diretamente ao endpoint `POST /v3/subscriptions/` do Asaas junto com o `remoteIp` do cliente

### Requirement 2: Remoção do endpoint legado de checkout

**User Story:** Como mantenedor do sistema, quero remover o endpoint `POST /billing/checkout` obsoleto, para que o código não mantenha fluxos duplicados e a base de código fique mais simples.

#### Acceptance Criteria

1. THE billing.routes.ts SHALL remover completamente o handler do endpoint `POST /billing/checkout`
2. WHEN uma requisição `POST /billing/checkout` é recebida após a remoção, THE Express_Router SHALL retornar HTTP 404
3. THE billing.routes.ts SHALL manter os endpoints `DELETE /billing/subscriptions/:id` e `POST /billing/webhook` sem alterações funcionais

### Requirement 3: Simplificação do webhook handler

**User Story:** Como mantenedor do sistema, quero remover o fallback de lookup de subscription no webhook handler, para que o código seja mais simples e não dependa de chamadas extras à API do Asaas durante o processamento de eventos.

#### Acceptance Criteria

1. THE Webhook_Handler SHALL remover o bloco de código que faz `GET /subscriptions/{subscriptionId}` na API do Asaas quando `externalReference` está vazio ou não começa com `kronuz:`
2. WHEN um evento de webhook é recebido sem `externalReference` válido (ausente ou sem prefixo `kronuz:`), THE Webhook_Handler SHALL registrar um aviso no console e retornar HTTP 200 sem processar o evento
3. WHILE o `externalReference` começa com `kronuz:`, THE Webhook_Handler SHALL parsear o formato `kronuz:{userId}:{planId}`, processar os eventos `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `SUBSCRIPTION_DELETED` e `SUBSCRIPTION_INACTIVATED`, e no evento `PAYMENT_CONFIRMED` atualizar o `UserPlan` com o `planId` extraído do `externalReference`
4. THE Webhook_Handler SHALL sempre retornar HTTP 200 para evitar loops de retry do Asaas, independentemente do resultado do processamento

### Requirement 4: Avaliação e limpeza do .env.example do core

**User Story:** Como desenvolvedor que configura o ambiente, quero que o `.env.example` reflita apenas as variáveis realmente necessárias, para que a configuração do ambiente seja clara e sem variáveis obsoletas.

#### Acceptance Criteria

1. THE trinity-scheduler-core/.env.example SHALL manter a variável `ASAAS_API_KEY` pois ela é necessária para chamadas à API do Asaas
2. THE trinity-scheduler-core/.env.example SHALL remover a variável `ASAAS_BASE_URL` pois o código já possui valor padrão `https://api-sandbox.asaas.com/v3` definido diretamente em `billing.routes.ts`
3. THE trinity-scheduler-core/.env.example SHALL adicionar a variável `ASAAS_WEBHOOK_TOKEN` com comentário explicativo, pois ela é usada pelo Webhook_Handler para validar requisições recebidas

### Requirement 5: Modal de assinatura no frontend

**User Story:** Como líder de estabelecimento, quero que ao selecionar um plano apareça um modal caprichado com meus dados já preenchidos e campos para CPF/CNPJ e cartão, para que eu possa assinar sem sair da tela atual.

#### Acceptance Criteria

1. WHEN o usuário clica para assinar um plano, THE Subscription_Screen SHALL abrir um modal sobreposto à tela atual sem redirecionar para outra página
2. THE Subscription_Screen SHALL exibir no modal os campos: `name` (pré-preenchido com `User.name`), `email` (pré-preenchido com `User.email`), `phone` (pré-preenchido com `Professional.phone` quando disponível), `cpfCnpj` (vazio, obrigatório), `postalCode` (vazio, obrigatório), `addressNumber` (vazio, obrigatório), e campos de cartão de crédito (número, nome do titular, mês de validade, ano de validade, CVV)
3. WHEN o usuário está autenticado, THE Subscription_Screen SHALL pré-preencher `name`, `email` e `phone` automaticamente a partir dos dados do usuário logado sem exigir digitação
4. THE Subscription_Screen SHALL exibir no topo do modal o nome do plano selecionado e o valor mensal em reais (convertido de centavos, formato `R$ X,XX`)
5. THE Subscription_Screen SHALL coletar os dados brutos do cartão de crédito e enviá-los ao backend via HTTPS — a tokenização ocorre no backend via API Asaas, não no frontend
6. WHEN o campo `cpfCnpj` está vazio e o usuário tenta confirmar a assinatura, THE Subscription_Screen SHALL exibir mensagem de validação indicando que o CPF/CNPJ é obrigatório
7. WHEN o `cpfCnpj` fornecido não tem 11 dígitos (CPF) nem 14 dígitos (CNPJ) após remoção de formatação, THE Subscription_Screen SHALL exibir mensagem de validação indicando formato inválido
8. WHEN a requisição ao Subscribe_Endpoint retorna erro, THE Subscription_Screen SHALL exibir a mensagem de erro ao usuário e permitir nova tentativa sem limpar os campos já preenchidos
9. WHEN a requisição ao Subscribe_Endpoint retorna erro, THE Subscription_Screen SHALL exibir a mensagem de erro ao usuário e permitir nova tentativa sem limpar os campos já preenchidos
10. WHEN a assinatura é criada com sucesso, THE Subscription_Screen SHALL fechar o modal e exibir confirmação de sucesso na tela de planos
11. WHILE a requisição ao Subscribe_Endpoint está em andamento, THE Subscription_Screen SHALL desabilitar o botão de confirmação e exibir indicador de carregamento para evitar submissões duplicadas
12. WHEN o usuário clica fora do modal ou no botão de fechar, THE Subscription_Screen SHALL fechar o modal sem realizar nenhuma ação

### Requirement 6: Segurança e validação no endpoint de assinatura

**User Story:** Como responsável pela segurança do sistema, quero que o endpoint de assinatura valide corretamente os dados de entrada e não exponha informações sensíveis, para que o sistema seja seguro e confiável.

#### Acceptance Criteria

1. THE Subscribe_Endpoint SHALL rejeitar requisições sem JWT válido com HTTP 401
2. THE Subscribe_Endpoint SHALL rejeitar requisições de usuários com role `professional` com HTTP 403
3. IF o campo `planId` estiver ausente no corpo da requisição, THEN THE Subscribe_Endpoint SHALL retornar HTTP 400 com `error: "VALIDATION_ERROR"`
4. IF o campo `cpfCnpj` estiver ausente no corpo da requisição, THEN THE Subscribe_Endpoint SHALL retornar HTTP 400 com `error: "VALIDATION_ERROR"`
5. IF o objeto `creditCard` ou qualquer campo obrigatório dele (`holderName`, `number`, `expiryMonth`, `expiryYear`, `ccv`) estiver ausente no corpo da requisição, THEN THE Subscribe_Endpoint SHALL retornar HTTP 400 com `error: "VALIDATION_ERROR"`
6. IF o campo `remoteIp` estiver ausente no corpo da requisição, THEN THE Subscribe_Endpoint SHALL retornar HTTP 400 com `error: "VALIDATION_ERROR"`
7. THE Subscribe_Endpoint SHALL nunca registrar em log dados de cartão de crédito (`creditCard.number`, `creditCard.ccv`) ou o `cpfCnpj` completo do usuário
