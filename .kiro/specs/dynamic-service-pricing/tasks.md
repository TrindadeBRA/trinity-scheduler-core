# Plano de Implementação: Precificação Dinâmica de Serviços

## Visão Geral

Implementação incremental em 4 camadas: modelo de dados (Prisma), lógica de negócio (core), painel administrativo (backoffice) e portal de agendamento (portal). Cada etapa constrói sobre a anterior, garantindo que não haja código órfão.

## Tarefas

- [x] 1. Modelo de dados e funções utilitárias (core)
  - [x] 1.1 Criar modelo `ServicePriceRule` no Prisma e gerar migration
    - Adicionar modelo `ServicePriceRule` em `core/prisma/schema.prisma` com campos: `id`, `serviceId`, `dayOfWeek` (Int[]), `price` (Int), relação com `Service` e `@@index([serviceId])`
    - Adicionar campo `priceRules ServicePriceRule[]` no modelo `Service`
    - Gerar migration com `npx prisma migrate dev --name add-service-price-rules`
    - _Requisitos: 1.1, 1.5_

  - [x] 1.2 Implementar `resolvePriceForDate` e `computePriceRange`
    - Criar arquivo `core/src/utils/priceResolver.ts`
    - `resolvePriceForDate(basePrice, priceRules, date)`: retorna o preço da regra cujo `dayOfWeek` contém o dia da semana da data, ou `basePrice` se nenhuma regra cobrir
    - `computePriceRange(basePrice, priceRules)`: retorna `{ minPrice, maxPrice }` considerando preço base e todas as regras
    - _Requisitos: 1.5, 6.1, 6.2_

  - [x] 1.3 Implementar `validatePriceRules`
    - Adicionar em `core/src/utils/priceResolver.ts`
    - Validar que cada dia está no intervalo [0, 6], preço é inteiro > 0, e não há dias duplicados entre regras
    - Retornar mensagens de erro específicas conforme tabela de erros do design
    - _Requisitos: 1.2, 1.3, 1.4_

  - [ ]* 1.4 Testes de propriedade para `resolvePriceForDate`
    - **Propriedade 1: Resolução de preço por dia da semana**
    - **Valida: Requisitos 1.5, 3.1, 3.3, 5.1**
    - Criar arquivo `core/src/utils/priceResolver.test.ts` usando fast-check
    - Gerar preço base, regras e datas aleatórias; verificar que o retorno corresponde à regra do dia ou ao preço base

  - [ ]* 1.5 Testes de propriedade para `validatePriceRules`
    - **Propriedade 2: Validação de regras de preço**
    - **Valida: Requisitos 1.2, 1.3**
    - Gerar arrays de dias e preços aleatórios; verificar aceitação/rejeição conforme intervalos válidos

  - [ ]* 1.6 Testes de propriedade para detecção de dias duplicados
    - **Propriedade 3: Detecção de dias duplicados entre regras**
    - **Valida: Requisitos 1.4, 2.3**
    - Gerar conjuntos de regras com e sem sobreposição; verificar rejeição correta

  - [ ]* 1.7 Testes de propriedade para `computePriceRange`
    - **Propriedade 5: Cálculo correto da faixa de preço**
    - **Valida: Requisitos 6.1, 6.2**
    - Gerar preço base e regras aleatórias; verificar que min/max correspondem ao menor/maior valor

- [x] 2. Checkpoint — Garantir que funções utilitárias e testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 3. Endpoints admin com suporte a regras de preço (core)
  - [x] 3.1 Modificar `POST /admin/services` para aceitar `priceRules`
    - Editar `core/src/routes/admin/services.routes.ts`
    - Extrair `priceRules` do body, validar com `validatePriceRules`, criar serviço e regras em transação `prisma.$transaction`
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 2.4_

  - [x] 3.2 Modificar `PUT /admin/services/:id` para aceitar `priceRules`
    - Editar `core/src/routes/admin/services.routes.ts`
    - Validar regras, deletar regras existentes e criar novas em transação (delete+create)
    - _Requisitos: 2.4, 2.5, 2.6_

  - [x] 3.3 Modificar `GET /admin/services` e `GET /admin/services/:id` para incluir `priceRules`
    - Editar `core/src/routes/admin/services.routes.ts`
    - Adicionar `include: { priceRules: true }` nas queries Prisma existentes
    - _Requisitos: 2.5_

  - [ ]* 3.4 Testes unitários para endpoints admin de regras de preço
    - Testar criação com regras válidas, rejeição de dias duplicados, atualização transacional, e carregamento de regras no GET
    - _Requisitos: 1.1, 1.4, 2.4, 2.5_

- [x] 4. Endpoints client com resolução de preço (core)
  - [x] 4.1 Modificar `GET /services` para incluir `minPrice` e `maxPrice`
    - Editar `core/src/routes/client/services.routes.ts`
    - Incluir `priceRules` na query e usar `computePriceRange` para calcular `minPrice`/`maxPrice` em cada serviço
    - _Requisitos: 6.1, 6.2, 6.3_

  - [x] 4.2 Criar endpoint `GET /services/prices?date=YYYY-MM-DD`
    - Adicionar nova rota em `core/src/routes/client/services.routes.ts`
    - Validar parâmetro `date` (formato e existência), retornar erro 400 se inválido
    - Buscar todos os serviços e addons ativos com suas regras, resolver preço para cada um usando `resolvePriceForDate`
    - Retornar `{ date, dayOfWeek, prices: [{ serviceId, price }] }`
    - _Requisitos: 5.1, 5.2, 5.3_

  - [ ]* 4.3 Teste de propriedade para rejeição de datas inválidas
    - **Propriedade 6: Rejeição de datas inválidas**
    - **Valida: Requisito 5.3**
    - Gerar strings aleatórias que não são datas válidas YYYY-MM-DD; verificar que o endpoint retorna 400

- [x] 5. Resolução de preço na criação de agendamento (core)
  - [x] 5.1 Modificar `createAppointment` para usar preço dinâmico
    - Editar `core/src/services/appointment.service.ts`
    - Buscar `priceRules` do serviço e de cada addon junto com a query existente
    - Usar `resolvePriceForDate` para calcular preço do serviço e de cada addon com base na data do agendamento
    - Substituir `service.price` e `a.price` pelos preços resolvidos no cálculo de `totalPrice` e na criação dos `AppointmentAddon`
    - _Requisitos: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 5.2 Teste de propriedade para preço total do agendamento
    - **Propriedade 4: Preço total do agendamento é a soma dos preços resolvidos**
    - **Valida: Requisitos 4.1, 4.2, 4.3**
    - Gerar serviço com regras, addons com regras e data aleatória; verificar que o total é a soma dos preços resolvidos

- [x] 6. Checkpoint — Garantir que backend está completo e testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 7. Backoffice — Tipos e serviço de API (backoffice)
  - [x] 7.1 Atualizar tipo `Service` e criar tipo `PriceRule`
    - Editar `backoffice/src/types/service.ts`
    - Adicionar interface `PriceRule { id?: string; dayOfWeek: number[]; price: number }` e campo `priceRules?: PriceRule[]` em `Service`
    - _Requisitos: 2.1, 2.5_

  - [x] 7.2 Atualizar `serviceService` para enviar/receber `priceRules`
    - Editar `backoffice/src/services/serviceService.ts`
    - No `create` e `update`: converter preços das regras de reais para centavos com `reaisToCents` antes de enviar
    - No `getById` e `getAll`: converter preços das regras de centavos para reais com `centsToReais`
    - _Requisitos: 2.4, 2.5_

- [x] 8. Backoffice — Seção de regras de preço no formulário de serviço (backoffice)
  - [x] 8.1 Criar componente `PriceRulesSection`
    - Criar `backoffice/src/components/services/PriceRulesSection.tsx`
    - Componente recebe `fields` (useFieldArray do react-hook-form) e renderiza lista de regras
    - Cada regra: chips/toggles para dias da semana (Dom–Sáb), input de preço em R$, botão remover
    - Botão "Adicionar regra" no final
    - Validação client-side: impedir dias duplicados entre regras, exibir mensagem de erro inline
    - _Requisitos: 2.1, 2.2, 2.3_

  - [x] 8.2 Integrar `PriceRulesSection` no `ServiceCreate.tsx`
    - Editar `backoffice/src/pages/services/ServiceCreate.tsx`
    - Adicionar `priceRules` ao tipo do formulário e ao `useCreateEdit` (defaultValues, toForm)
    - Usar `useFieldArray` para gerenciar as regras
    - Renderizar `PriceRulesSection` abaixo do campo de preço base
    - Incluir `priceRules` no payload do `onSubmit`
    - _Requisitos: 2.1, 2.2, 2.4, 2.5, 2.6_

  - [ ]* 8.3 Testes unitários para validação de dias duplicados no backoffice
    - Testar que a validação client-side detecta sobreposição de dias entre regras
    - _Requisitos: 2.3_

- [x] 9. Checkpoint — Garantir que backoffice está integrado e funcional
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 10. Portal — Tipos e serviço de API (portal)
  - [x] 10.1 Atualizar tipo `Service` com `minPrice` e `maxPrice`
    - Editar `portal/src/lib/types.ts`
    - Adicionar campos opcionais `minPrice?: number` e `maxPrice?: number` em `Service` e `AddonService`
    - _Requisitos: 6.1, 6.3_

  - [x] 10.2 Atualizar `getServices` para mapear `minPrice`/`maxPrice`
    - Editar `portal/src/services/serviceService.ts`
    - Converter `minPrice` e `maxPrice` de centavos para reais com `centsToReais`
    - _Requisitos: 6.1, 6.3_

  - [x] 10.3 Criar função `getServicePrices(date: string)`
    - Editar `portal/src/services/serviceService.ts`
    - Chamar `GET /services/prices?date=...`, converter preços de centavos para reais
    - Retornar `Record<string, number>` (serviceId → preço em reais)
    - _Requisitos: 5.1, 5.2_

- [x] 11. Portal — Exibição de faixa de preço e resolução por data (portal)
  - [x] 11.1 Atualizar `ServiceCard` para exibir faixa de preço
    - Editar `portal/src/components/booking/ServiceCard.tsx`
    - Quando `minPrice !== maxPrice`, exibir "R$ X – R$ Y" usando `formatCurrency`
    - Quando iguais ou sem regras, exibir preço único como hoje
    - _Requisitos: 6.1, 6.2_

  - [x] 11.2 Adicionar estado `resolvedPrices` ao `bookingStore`
    - Editar `portal/src/stores/bookingStore.ts`
    - Adicionar `resolvedPrices: Record<string, number>` e action `setResolvedPrices`
    - Limpar `resolvedPrices` no `reset`
    - _Requisitos: 3.1, 3.2_

  - [x] 11.3 Chamar `getServicePrices` ao selecionar data no `DateTimeSelection`
    - Editar `portal/src/components/booking/DateTimeSelection.tsx`
    - Ao selecionar/alterar data, chamar `getServicePrices(date)` e atualizar `resolvedPrices` no store
    - _Requisitos: 3.1, 3.2_

  - [x] 11.4 Usar preço resolvido no `BookingConfirmation`
    - Editar `portal/src/components/booking/BookingConfirmation.tsx`
    - Ler `resolvedPrices` do store; usar preço resolvido do serviço e de cada addon (se disponível) em vez do `service.price` fixo
    - Recalcular `totalPrice` com preços resolvidos
    - _Requisitos: 3.3, 3.4_

  - [x] 11.5 Atualizar `getAddons` para mapear `minPrice`/`maxPrice`
    - Editar `portal/src/services/addonService.ts`
    - Converter `minPrice` e `maxPrice` de centavos para reais, similar ao `getServices`
    - _Requisitos: 6.1_

  - [ ]* 11.6 Testes unitários para exibição de faixa de preço no ServiceCard
    - Testar renderização com minPrice === maxPrice (preço único) e minPrice !== maxPrice (faixa)
    - _Requisitos: 6.1, 6.2_

- [x] 12. Checkpoint final — Garantir que tudo está integrado e todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude
- Testes unitários validam exemplos específicos e casos de borda
- Preços são sempre em centavos no backend e convertidos para reais no frontend
