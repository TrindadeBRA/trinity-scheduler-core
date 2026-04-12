# Documento de Requisitos — Bloqueios de Horário Recorrentes

## Introdução

Melhoria na funcionalidade existente de "Bloquear Horário" na página `/agenda` do painel administrativo. Atualmente, o usuário cria bloqueios individuais (um por vez). Esta feature adiciona suporte a recorrência, permitindo criar bloqueios que se repetem em dias da semana selecionados até uma data limite. Também permite gerenciar (remover) bloqueios criados em série, com opções de remoção individual, deste em diante, ou de toda a série.

## Glossário

- **Sistema_Bloqueio**: Módulo responsável por criar, listar e remover bloqueios de horário no backend (API + banco de dados)
- **Dialog_Bloqueio**: Componente `TimeBlockDialog` no frontend que permite ao usuário criar ou remover bloqueios de horário
- **Série_Recorrente**: Conjunto de bloqueios de horário criados a partir de uma única operação de recorrência, identificados por um `recurrenceGroupId` compartilhado
- **Dias_Recorrência**: Dias da semana selecionados pelo usuário para repetição do bloqueio (ex: Segunda, Quarta, Sexta)
- **Data_Limite**: Data final (inclusive) até a qual os bloqueios recorrentes são gerados
- **Ocorrência**: Um bloqueio individual dentro de uma Série_Recorrente
- **Profissional**: Usuário do tipo profissional vinculado ao estabelecimento

## Requisitos

### Requisito 1: Campo de Recorrência no Dialog

**User Story:** Como administrador/líder, quero selecionar dias da semana para recorrência ao criar um bloqueio de horário, para que eu possa bloquear horários repetitivos de forma rápida.

#### Critérios de Aceitação

1. WHEN o Dialog_Bloqueio é aberto no modo criação, THE Dialog_Bloqueio SHALL exibir um campo "Recorrência" acima do campo "Motivo", contendo checkboxes para cada dia da semana (Segunda, Terça, Quarta, Quinta, Sexta, Sábado, Domingo)
2. THE Dialog_Bloqueio SHALL manter o campo "Recorrência" desmarcado por padrão, preservando o comportamento atual de bloqueio único
3. WHEN o usuário seleciona um ou mais Dias_Recorrência, THE Dialog_Bloqueio SHALL exibir o campo "Até" (Data_Limite) abaixo do campo "Recorrência"
4. WHEN nenhum dia de recorrência está selecionado, THE Dialog_Bloqueio SHALL ocultar o campo "Até" e criar apenas um bloqueio único (comportamento atual)
5. THE Dialog_Bloqueio SHALL pré-selecionar o dia da semana correspondente à data escolhida no campo "Data e horário" nos Dias_Recorrência

### Requisito 2: Campo Data Limite (Até)

**User Story:** Como administrador/líder, quero definir até quando os bloqueios recorrentes devem ser gerados, para que eu tenha controle sobre o período de repetição.

#### Critérios de Aceitação

1. WHEN o campo "Até" é exibido, THE Dialog_Bloqueio SHALL apresentar um seletor de data (date picker) para a Data_Limite
2. THE Dialog_Bloqueio SHALL aceitar apenas datas futuras (posteriores à data do bloqueio inicial) como Data_Limite
3. THE Dialog_Bloqueio SHALL impedir o envio do formulário enquanto a Data_Limite não estiver preenchida, quando Dias_Recorrência estiverem selecionados
4. THE Dialog_Bloqueio SHALL limitar a Data_Limite a no máximo 1 ano a partir da data atual

### Requisito 3: Criação de Bloqueios Recorrentes no Backend

**User Story:** Como administrador/líder, quero que o sistema gere automaticamente todos os bloqueios da série recorrente, para que eu não precise criá-los manualmente um a um.

#### Critérios de Aceitação

1. WHEN o Sistema_Bloqueio recebe uma requisição de criação com Dias_Recorrência e Data_Limite, THE Sistema_Bloqueio SHALL gerar uma Ocorrência para cada data que corresponda aos Dias_Recorrência selecionados, desde a data inicial até a Data_Limite (inclusive)
2. THE Sistema_Bloqueio SHALL atribuir o mesmo `recurrenceGroupId` (UUID) a todas as Ocorrências de uma Série_Recorrente
3. THE Sistema_Bloqueio SHALL armazenar os Dias_Recorrência e a Data_Limite na tabela de bloqueios como metadados da série
4. WHEN o Sistema_Bloqueio recebe uma requisição de criação sem Dias_Recorrência, THE Sistema_Bloqueio SHALL criar um bloqueio único sem `recurrenceGroupId` (comportamento atual preservado)
5. THE Sistema_Bloqueio SHALL criar todas as Ocorrências de uma Série_Recorrente em uma única transação atômica
6. IF a criação de qualquer Ocorrência falhar durante a transação, THEN THE Sistema_Bloqueio SHALL reverter todas as Ocorrências da série e retornar um erro descritivo

### Requisito 4: Remoção de Bloqueios Recorrentes

**User Story:** Como administrador/líder, quero opções flexíveis ao remover um bloqueio que faz parte de uma série recorrente, para que eu possa ajustar a agenda sem perder toda a série.

#### Critérios de Aceitação

1. WHEN o usuário clica em uma Ocorrência de uma Série_Recorrente na agenda, THE Dialog_Bloqueio SHALL exibir três opções de remoção: "Remover apenas este", "Remover este e os próximos" e "Remover todos da série"
2. WHEN o usuário seleciona "Remover apenas este", THE Sistema_Bloqueio SHALL remover somente a Ocorrência selecionada, mantendo as demais Ocorrências da Série_Recorrente intactas
3. WHEN o usuário seleciona "Remover este e os próximos", THE Sistema_Bloqueio SHALL remover a Ocorrência selecionada e todas as Ocorrências da mesma Série_Recorrente com data igual ou posterior
4. WHEN o usuário seleciona "Remover todos da série", THE Sistema_Bloqueio SHALL remover todas as Ocorrências da Série_Recorrente
5. WHEN o usuário clica em um bloqueio que não pertence a nenhuma Série_Recorrente, THE Dialog_Bloqueio SHALL exibir apenas a confirmação simples de remoção (comportamento atual)
6. THE Sistema_Bloqueio SHALL executar a remoção de múltiplas Ocorrências em uma única transação atômica

### Requisito 5: Alteração do Schema do Banco de Dados

**User Story:** Como desenvolvedor, quero que o modelo de dados suporte recorrência, para que os bloqueios recorrentes sejam armazenados e consultados de forma eficiente.

#### Critérios de Aceitação

1. THE Sistema_Bloqueio SHALL adicionar o campo `recurrenceGroupId` (String, opcional, UUID) ao modelo `TimeBlock` no schema Prisma
2. THE Sistema_Bloqueio SHALL adicionar o campo `recurrenceDays` (String[], opcional) ao modelo `TimeBlock` para armazenar os dias da semana da recorrência
3. THE Sistema_Bloqueio SHALL adicionar o campo `recurrenceEndDate` (String, opcional) ao modelo `TimeBlock` para armazenar a Data_Limite
4. THE Sistema_Bloqueio SHALL criar um índice no campo `recurrenceGroupId` para consultas eficientes por série

### Requisito 6: Indicação Visual de Bloqueio Recorrente

**User Story:** Como administrador/líder, quero identificar visualmente na agenda quais bloqueios fazem parte de uma série recorrente, para diferenciá-los de bloqueios avulsos.

#### Critérios de Aceitação

1. WHILE um bloqueio pertence a uma Série_Recorrente, THE Dialog_Bloqueio SHALL exibir um indicador visual (ícone de repetição) ao lado do bloqueio na agenda
2. WHEN o usuário passa o cursor sobre um bloqueio recorrente na agenda, THE Dialog_Bloqueio SHALL exibir um tooltip informando que o bloqueio faz parte de uma série recorrente

### Requisito 7: Validação de Conflito com Agendamentos Existentes

**User Story:** Como administrador/líder, quero ser avisado quando um bloqueio recorrente conflita com agendamentos já existentes, para que eu não bloqueie horários que já têm clientes agendados.

#### Critérios de Aceitação

1. BEFORE criar as Ocorrências de uma Série_Recorrente, THE Sistema_Bloqueio SHALL verificar se alguma data/horário gerado conflita com agendamentos existentes (status `confirmed` ou `pending`) do mesmo Profissional
2. WHEN um ou mais conflitos são detectados, THE Sistema_Bloqueio SHALL retornar erro 409 (CONFLICT) com a lista de conflitos, incluindo para cada um: data, horário do agendamento, nome do cliente e nome do serviço
3. THE Dialog_Bloqueio SHALL exibir a lista de conflitos de forma amigável ao usuário, mostrando quais datas/horários possuem agendamentos que impedem o bloqueio
4. THE Sistema_Bloqueio SHALL aplicar a mesma validação de conflito para bloqueios únicos (sem recorrência)
5. A verificação de conflito SHALL considerar sobreposição de horários: um agendamento conflita quando seu intervalo [time, time+duration] se sobrepõe ao intervalo [startTime, startTime+duration] do bloqueio

### Requisito 8: Endpoint de Remoção com Escopo

**User Story:** Como desenvolvedor, quero um endpoint que suporte diferentes escopos de remoção, para que o frontend possa solicitar remoções parciais ou totais de uma série.

#### Critérios de Aceitação

1. THE Sistema_Bloqueio SHALL aceitar um parâmetro `scope` no endpoint de remoção com os valores: `single`, `future` e `all`
2. WHEN o parâmetro `scope` é `single`, THE Sistema_Bloqueio SHALL remover apenas o bloqueio identificado pelo `id`
3. WHEN o parâmetro `scope` é `future`, THE Sistema_Bloqueio SHALL remover o bloqueio identificado pelo `id` e todos os bloqueios com o mesmo `recurrenceGroupId` cuja data seja igual ou posterior à data do bloqueio selecionado
4. WHEN o parâmetro `scope` é `all`, THE Sistema_Bloqueio SHALL remover todos os bloqueios com o mesmo `recurrenceGroupId`
5. WHEN o bloqueio não possui `recurrenceGroupId` e o `scope` é `future` ou `all`, THE Sistema_Bloqueio SHALL remover apenas o bloqueio individual (fallback para comportamento de bloqueio único)
6. IF o bloqueio identificado pelo `id` não existir, THEN THE Sistema_Bloqueio SHALL retornar erro 404 com código `NOT_FOUND`


