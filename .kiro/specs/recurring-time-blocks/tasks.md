# Plano de Implementação: Bloqueios de Horário Recorrentes

## Visão Geral

Implementação incremental da feature de bloqueios recorrentes, começando pela migração do schema, passando pela lógica de negócio no backend, endpoints da API, e finalizando com as alterações no frontend (backoffice). Cada tarefa constrói sobre a anterior, garantindo que o código esteja sempre integrado e funcional.

## Tarefas

- [ ] 1. Migração do Schema Prisma e tipos base
  - [ ] 1.1 Adicionar campos de recorrência ao modelo TimeBlock no schema Prisma
    - Adicionar `recurrenceGroupId String?` ao modelo `TimeBlock` em `core/prisma/schema.prisma`
    - Adicionar `recurrenceDays String[]` ao modelo `TimeBlock`
    - Adicionar `recurrenceEndDate String?` ao modelo `TimeBlock`
    - Adicionar `@@index([recurrenceGroupId])` ao modelo `TimeBlock`
    - Executar `yarn prisma:migrate` para gerar a migration
    - _Requisitos: 5.1, 5.2, 5.3, 5.4_

  - [ ] 1.2 Atualizar o tipo TimeBlock no frontend
    - Adicionar `recurrenceGroupId: string | null` à interface `TimeBlock` em `backoffice/src/types/timeBlock.ts`
    - Adicionar `recurrenceDays: string[]` à interface
    - Adicionar `recurrenceEndDate: string | null` à interface
    - _Requisitos: 5.1, 5.2, 5.3_

- [ ] 2. Serviço de bloqueios recorrentes no backend
  - [ ] 2.1 Criar `timeblock.service.ts` com a função `generateRecurrenceDates`
    - Criar arquivo `core/src/services/timeblock.service.ts`
    - Implementar função pura `generateRecurrenceDates({ startDate, recurrenceDays, recurrenceEndDate })` que retorna array de datas `"YYYY-MM-DD"`
    - Usar mapeamento de dias consistente com `availability.service.ts` (Domingo, Segunda, ..., Sábado)
    - _Requisitos: 3.1_

  - [ ]* 2.2 Escrever teste de propriedade para `generateRecurrenceDates`
    - **Propriedade 3: Corretude da geração de datas recorrentes**
    - Gerar combinações aleatórias de (dataInicial, subconjunto de dias, offset 1-365)
    - Verificar: todas as datas no intervalo, nos dias corretos, sem faltas (completude)
    - **Valida: Requisito 3.1**

  - [ ]* 2.3 Escrever teste de propriedade para mapeamento data → dia da semana
    - **Propriedade 1: Mapeamento data → dia da semana**
    - Gerar datas aleatórias válidas e verificar que o dia da semana corresponde ao esperado
    - **Valida: Requisito 1.5**

  - [ ]* 2.4 Escrever teste de propriedade para validação da data limite
    - **Propriedade 2: Validação da data limite**
    - Gerar pares (dataInicial, dataLimite) e verificar rejeição/aceitação conforme regras
    - **Valida: Requisitos 2.2, 2.4**

  - [ ] 2.5 Implementar `checkAppointmentConflicts` no `timeblock.service.ts`
    - Buscar agendamentos do profissional nas datas geradas com status `confirmed`
    - Verificar sobreposição de horário: `appointmentStart < blockEnd && blockStart < appointmentEnd`
    - Retornar lista de `{ date, time, clientName, serviceName }`
    - _Requisitos: 7.1, 7.4, 7.5_

  - [ ]* 2.6 Escrever teste de propriedade para detecção de conflitos
    - **Propriedade 8: Detecção de conflitos com agendamentos**
    - Gerar bloqueio + agendamento com horários sobrepostos/não-sobrepostos
    - Verificar que conflito é detectado sse intervalos se sobrepõem
    - **Valida: Requisitos 7.1, 7.2, 7.5**

  - [ ] 2.7 Implementar `createTimeBlocks` no `timeblock.service.ts`
    - Se `recurrenceDays` vazio/ausente → criar bloqueio único (comportamento atual)
    - Se `recurrenceDays` presente → gerar UUID para `recurrenceGroupId`, calcular datas via `generateRecurrenceDates`, verificar conflitos via `checkAppointmentConflicts`, criar todos em `prisma.$transaction`
    - Validar: `recurrenceEndDate` obrigatório quando `recurrenceDays` presente, `recurrenceEndDate > date`, `recurrenceEndDate ≤ date + 1 ano`
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1, 7.4_

  - [ ]* 2.8 Escrever teste de propriedade para invariante de metadados da série
    - **Propriedade 4: Invariante de metadados da série recorrente**
    - Verificar que todos os bloqueios de uma série compartilham o mesmo `recurrenceGroupId`, `recurrenceDays` e `recurrenceEndDate`
    - **Valida: Requisitos 3.2, 3.3**

- [ ] 3. Checkpoint — Verificar serviço backend
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [ ] 4. Endpoints da API (rotas)
  - [ ] 4.1 Alterar POST `/admin/timeblocks` para suportar recorrência
    - Modificar `core/src/routes/admin/timeblocks.routes.ts`
    - Aceitar campos opcionais `recurrenceDays` e `recurrenceEndDate` no body
    - Delegar criação para `createTimeBlocks` do serviço
    - Retornar 409 com lista de conflitos quando `checkAppointmentConflicts` encontrar conflitos
    - Manter backward compatibility: sem `recurrenceDays` → bloqueio único
    - _Requisitos: 3.1, 3.4, 7.1, 7.2_

  - [ ] 4.2 Alterar DELETE `/admin/timeblocks/:id` para suportar escopo
    - Aceitar query param `scope` com valores `single`, `future`, `all` (default: `single`)
    - `scope=single` ou bloqueio sem `recurrenceGroupId` → `delete({ id })`
    - `scope=future` → `deleteMany({ recurrenceGroupId, date: { gte: block.date } })`
    - `scope=all` → `deleteMany({ recurrenceGroupId })`
    - Validar scope inválido → 400
    - Fallback: bloqueio sem `recurrenceGroupId` com `scope=future|all` → remove apenas o individual
    - _Requisitos: 4.2, 4.3, 4.4, 4.5, 4.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 4.3 Escrever testes de propriedade para remoção com escopo
    - **Propriedade 5: Remoção com escopo single preserva os demais**
    - **Propriedade 6: Remoção com escopo future remove corretamente**
    - **Propriedade 7: Remoção com escopo all remove toda a série**
    - **Valida: Requisitos 4.2, 4.3, 4.4, 7.2, 7.3, 7.4**

- [ ] 5. Checkpoint — Verificar API completa
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [ ] 6. Serviço frontend e dialog de criação
  - [ ] 6.1 Atualizar `timeBlockService.ts` no backoffice
    - Alterar `create` para aceitar `recurrenceDays?: string[]` e `recurrenceEndDate?: string` no payload
    - Alterar `delete` para aceitar `scope?: "single" | "future" | "all"` e enviar como query param
    - _Requisitos: 3.1, 4.1, 8.1_

  - [ ] 6.2 Adicionar campos de recorrência ao `TimeBlockDialog` (modo criação)
    - Adicionar grupo de 7 checkboxes (Seg–Dom) acima do campo "Motivo" com label "Recorrência"
    - Pré-selecionar o dia da semana correspondente à data do campo "Data e horário"
    - Quando ≥1 dia selecionado, exibir campo "Até" (date picker) abaixo dos checkboxes
    - Validar: Data_Limite obrigatória quando dias selecionados, deve ser futura e ≤ 1 ano
    - Enviar `recurrenceDays` e `recurrenceEndDate` no payload de criação
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4_

  - [ ] 6.3 Implementar exibição de conflitos no `TimeBlockDialog`
    - Quando a API retorna 409 com `conflicts`, exibir lista amigável dos agendamentos conflitantes
    - Mostrar data, horário, nome do cliente e nome do serviço em um `Alert` dentro do dialog
    - Não fechar o dialog em caso de conflito
    - _Requisitos: 7.2, 7.3_

- [ ] 7. Dialog de remoção com escopo e indicadores visuais
  - [ ] 7.1 Alterar modo remoção do `TimeBlockDialog` para suportar escopo
    - Se `timeBlock.recurrenceGroupId` existe → exibir 3 radio buttons: "Remover apenas este", "Remover este e os próximos", "Remover todos da série"
    - Se não tem `recurrenceGroupId` → confirmação simples (comportamento atual)
    - Enviar `scope` correspondente na chamada de `timeBlockService.delete`
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 7.2 Adicionar indicador visual de recorrência no `DayView`
    - No componente `TimeBlockEvent` em `backoffice/src/components/agenda/DayView.tsx`
    - Se `block.recurrenceGroupId` existe → adicionar ícone `Repeat` (lucide) ao lado do ícone `ShieldBan`
    - Atualizar tooltip: "Bloqueado (recorrente): {reason}" ou "Bloqueado (recorrente)"
    - _Requisitos: 6.1, 6.2_

- [ ] 8. Atualizar documentação Swagger
  - [ ] 8.1 Atualizar Swagger para os endpoints de timeblocks
    - Atualizar a documentação do POST `/admin/timeblocks` em `core/src/config/swagger.ts` (ou inline nas rotas) para incluir os novos campos `recurrenceDays` e `recurrenceEndDate` no request body
    - Documentar a resposta 409 CONFLICT com o schema de `conflicts: [{ date, time, clientName, serviceName }]`
    - Atualizar a documentação do DELETE `/admin/timeblocks/:id` para incluir o query param `scope` (enum: single, future, all)
    - Adicionar/atualizar o schema `TimeBlock` no Swagger com os novos campos `recurrenceGroupId`, `recurrenceDays`, `recurrenceEndDate`

- [ ] 9. Checkpoint final — Verificar integração completa
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude (P1–P8)
- Testes unitários validam exemplos específicos e edge cases
