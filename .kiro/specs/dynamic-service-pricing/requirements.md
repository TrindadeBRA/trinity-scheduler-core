# Documento de Requisitos — Precificação Dinâmica de Serviços

## Introdução

Esta funcionalidade permite que os estabelecimentos configurem preços diferenciados para seus serviços com base no dia da semana. Atualmente, cada serviço possui um único campo `price`. Com a precificação dinâmica, o dono do estabelecimento poderá definir grupos de dias (ex.: segunda e terça, quinta e sexta, sábado e domingo) com preços distintos para cada serviço. O preço correto será exibido no portal de agendamento conforme a data selecionada pelo cliente e será gravado no agendamento no momento da criação.

## Glossário

- **Sistema_Kronuz**: A plataforma de agendamento composta pelo backend (core), painel administrativo (backoffice) e portal de agendamento (portal).
- **Serviço**: Entidade que representa um serviço oferecido pelo estabelecimento (ex.: Corte de Cabelo, Barba). Possui tipo `service` ou `addon`.
- **Regra_de_Preço**: Registro que associa um serviço a um conjunto de dias da semana e um preço específico em centavos.
- **Preço_Base**: O campo `price` existente no modelo Service, utilizado como preço padrão quando não há Regra_de_Preço configurada para um determinado dia.
- **Dia_da_Semana**: Valor inteiro de 0 (domingo) a 6 (sábado) representando um dia da semana.
- **Agendamento**: Registro de um atendimento marcado por um cliente, contendo data, horário, serviço, profissional e preço final.
- **Backoffice**: Painel administrativo usado pelos donos e líderes do estabelecimento.
- **Portal**: Aplicação voltada ao cliente para realizar agendamentos online.

## Requisitos

### Requisito 1: Modelo de dados para regras de preço

**User Story:** Como dono de estabelecimento, quero cadastrar regras de preço por dia da semana para meus serviços, para que eu possa cobrar valores diferentes conforme o dia do atendimento.

#### Critérios de Aceitação

1. THE Sistema_Kronuz SHALL armazenar cada Regra_de_Preço com os campos: identificador único, referência ao Serviço, lista de Dia_da_Semana aplicáveis e preço em centavos (inteiro positivo).
2. WHEN uma Regra_de_Preço é criada, THE Sistema_Kronuz SHALL validar que os dias da semana informados são valores inteiros entre 0 e 6.
3. WHEN uma Regra_de_Preço é criada, THE Sistema_Kronuz SHALL validar que o preço informado é um inteiro maior que zero.
4. WHEN uma Regra_de_Preço é criada para um Serviço, THE Sistema_Kronuz SHALL rejeitar a criação se algum Dia_da_Semana informado já estiver coberto por outra Regra_de_Preço do mesmo Serviço.
5. THE Sistema_Kronuz SHALL manter o campo Preço_Base existente no Serviço como valor padrão para dias sem Regra_de_Preço configurada.

### Requisito 2: CRUD de regras de preço no backoffice

**User Story:** Como dono de estabelecimento, quero gerenciar as regras de preço diretamente na tela de criação/edição de serviço, para que a configuração seja simples e centralizada.

#### Critérios de Aceitação

1. WHEN o usuário acessa o formulário de criação ou edição de Serviço no Backoffice, THE Sistema_Kronuz SHALL exibir uma seção para configurar regras de preço por dia da semana.
2. WHEN o usuário adiciona uma Regra_de_Preço, THE Sistema_Kronuz SHALL permitir selecionar um ou mais Dia_da_Semana e informar o preço correspondente.
3. WHEN o usuário tenta salvar regras com dias duplicados entre diferentes regras do mesmo Serviço, THE Sistema_Kronuz SHALL exibir uma mensagem de erro indicando o conflito.
4. WHEN o usuário salva o Serviço com regras de preço, THE Sistema_Kronuz SHALL persistir as Regras_de_Preço associadas ao Serviço em uma única operação transacional.
5. WHEN o usuário edita um Serviço existente, THE Sistema_Kronuz SHALL carregar as Regras_de_Preço já cadastradas para edição.
6. WHEN o usuário remove todas as Regras_de_Preço de um Serviço, THE Sistema_Kronuz SHALL utilizar exclusivamente o Preço_Base para todos os dias.

### Requisito 3: Resolução de preço no portal de agendamento

**User Story:** Como cliente, quero ver o preço correto do serviço conforme o dia que estou agendando, para que eu saiba exatamente quanto vou pagar.

#### Critérios de Aceitação

1. WHEN o cliente seleciona uma data no Portal, THE Sistema_Kronuz SHALL exibir o preço do Serviço correspondente ao Dia_da_Semana da data selecionada.
2. WHEN o cliente altera a data selecionada no Portal, THE Sistema_Kronuz SHALL recalcular e atualizar o preço exibido do Serviço e dos Adicionais conforme o novo Dia_da_Semana.
3. WHEN não existe Regra_de_Preço para o Dia_da_Semana da data selecionada, THE Sistema_Kronuz SHALL exibir o Preço_Base do Serviço.
4. WHEN o cliente visualiza a tela de confirmação do agendamento, THE Sistema_Kronuz SHALL exibir o preço total calculado com base no Dia_da_Semana da data selecionada (serviço + adicionais).

### Requisito 4: Cálculo de preço na criação do agendamento

**User Story:** Como dono de estabelecimento, quero que o preço gravado no agendamento reflita a regra de preço do dia, para que meus relatórios financeiros sejam precisos.

#### Critérios de Aceitação

1. WHEN um Agendamento é criado, THE Sistema_Kronuz SHALL calcular o preço do Serviço com base no Dia_da_Semana da data do Agendamento.
2. WHEN um Agendamento é criado com Adicionais que possuem Regras_de_Preço, THE Sistema_Kronuz SHALL calcular o preço de cada Adicional com base no Dia_da_Semana da data do Agendamento.
3. THE Sistema_Kronuz SHALL gravar o preço total resolvido (serviço + adicionais) no campo `price` do Agendamento no momento da criação.
4. WHEN a Regra_de_Preço de um Serviço é alterada após a criação de um Agendamento, THE Sistema_Kronuz SHALL manter o preço original gravado no Agendamento inalterado.

### Requisito 5: Endpoint de resolução de preço por data

**User Story:** Como desenvolvedor do portal, quero um endpoint que retorne o preço de um serviço para uma data específica, para que o frontend possa exibir o preço correto sem lógica duplicada.

#### Critérios de Aceitação

1. WHEN o Portal solicita o preço de um Serviço informando uma data, THE Sistema_Kronuz SHALL retornar o preço resolvido para o Dia_da_Semana correspondente.
2. WHEN o Portal solicita o preço de múltiplos Serviços (incluindo Adicionais) informando uma data, THE Sistema_Kronuz SHALL retornar os preços resolvidos de todos os Serviços solicitados em uma única resposta.
3. IF a data informada for inválida ou ausente, THEN THE Sistema_Kronuz SHALL retornar um erro de validação com código 400.

### Requisito 6: Exibição de faixa de preço na listagem de serviços

**User Story:** Como cliente, quero ver a faixa de preço de um serviço antes de escolher a data, para que eu tenha uma noção do custo.

#### Critérios de Aceitação

1. WHEN o cliente visualiza a listagem de Serviços no Portal antes de selecionar uma data, THE Sistema_Kronuz SHALL exibir a faixa de preço do Serviço (menor e maior preço entre todas as Regras_de_Preço e o Preço_Base).
2. WHEN um Serviço possui apenas o Preço_Base (sem Regras_de_Preço), THE Sistema_Kronuz SHALL exibir o preço único sem formato de faixa.
3. WHEN o endpoint de listagem de Serviços é chamado, THE Sistema_Kronuz SHALL incluir os campos `minPrice` e `maxPrice` na resposta de cada Serviço.

### Requisito 7: Compatibilidade com relatórios e dashboard

**User Story:** Como dono de estabelecimento, quero que os relatórios de faturamento continuem funcionando corretamente com a precificação dinâmica, para que eu não perca visibilidade financeira.

#### Critérios de Aceitação

1. THE Sistema_Kronuz SHALL continuar calculando o faturamento nos relatórios e dashboard a partir do campo `price` gravado no Agendamento.
2. WHEN o relatório de faturamento por serviço é gerado, THE Sistema_Kronuz SHALL agrupar os valores pelo preço efetivamente cobrado (gravado no Agendamento), independentemente das Regras_de_Preço atuais.
