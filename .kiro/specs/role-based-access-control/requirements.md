# Requirements Document

## Introduction

Este documento especifica os requisitos para implementação de um sistema de controle de acesso baseado em roles (RBAC - Role-Based Access Control) para o painel administrativo do Trinity Scheduler. O sistema já possui roles definidas (admin, leader, professional) no banco de dados, mas atualmente não implementa controle de acesso efetivo baseado nessas roles. Esta feature implementará validação e filtragem de dados tanto no backend (API) quanto no frontend (interface administrativa), garantindo que cada role tenha acesso apenas aos recursos e dados apropriados.

## Glossary

- **RBAC**: Role-Based Access Control - Sistema de controle de acesso baseado em papéis/funções
- **Role**: Papel ou função atribuída a um usuário (admin, leader, professional)
- **Admin**: Usuário com acesso completo a todas as funcionalidades do sistema
- **Leader**: Usuário com acesso a todos os dados e funcionalidades do estabelecimento
- **Professional**: Usuário profissional com acesso restrito apenas aos seus próprios dados
- **API**: Interface de programação de aplicações (backend)
- **Frontend**: Interface do usuário (painel administrativo)
- **Dashboard**: Painel principal com widgets e estatísticas
- **Revenue**: Módulo de relatórios de receita e faturamento
- **Agenda**: Módulo de visualização e gestão de agendamentos
- **Middleware**: Componente intermediário que processa requisições antes de chegarem aos handlers
- **JWT**: JSON Web Token - Token de autenticação que contém informações do usuário
- **Credential**: Credenciais de acesso (email e senha) para login no sistema

## Requirements

### Requirement 1: Controle de Acesso por Role no Backend

**User Story:** Como desenvolvedor do sistema, eu quero implementar validação de roles no backend, para que apenas usuários autorizados possam acessar recursos específicos e visualizar dados apropriados à sua role.

#### Acceptance Criteria

1. WHEN uma requisição é feita a um endpoint administrativo, THE API SHALL validar a role do usuário autenticado antes de processar a requisição
2. IF um usuário tenta acessar um recurso sem a role apropriada, THEN THE API SHALL retornar erro 403 (FORBIDDEN) com mensagem descritiva
3. THE Middleware_de_Autorização SHALL verificar se a role do usuário está na lista de roles permitidas para o endpoint
4. THE Middleware_de_Autorização SHALL extrair a role do JWT token decodificado
5. WHEN um Professional faz uma requisição, THE API SHALL automaticamente filtrar os dados para retornar apenas registros associados ao seu professionalId
6. THE API SHALL aplicar filtros de dados no nível de query do Prisma para garantir isolamento de dados por role

### Requirement 2: Filtragem de Dados do Dashboard para Professional

**User Story:** Como profissional, eu quero visualizar apenas meus próprios dados no dashboard, para que eu possa acompanhar meu desempenho individual sem acessar dados de outros profissionais.

#### Acceptance Criteria

1. WHEN um Professional acessa o endpoint de estatísticas do dashboard, THE API SHALL filtrar os dados apenas para agendamentos onde professionalId corresponde ao ID do profissional autenticado
2. THE Dashboard_Stats_Endpoint SHALL calcular receita (revenue) apenas dos agendamentos do profissional
3. THE Dashboard_Stats_Endpoint SHALL contar appointmentCount apenas dos agendamentos do profissional
4. THE Dashboard_Stats_Endpoint SHALL identificar topService apenas entre os serviços agendados pelo profissional
5. THE Dashboard_Stats_Endpoint SHALL contar newClients apenas para clientes que fizeram primeiro agendamento com o profissional
6. WHEN um Leader ou Admin acessa o dashboard, THE API SHALL retornar dados de todos os profissionais do estabelecimento

### Requirement 3: Filtragem de Dados de Revenue para Professional

**User Story:** Como profissional, eu quero visualizar apenas meus relatórios de receita, para que eu possa acompanhar meu faturamento individual sem acessar dados financeiros de outros profissionais.

#### Acceptance Criteria

1. WHEN um Professional acessa o endpoint de resumo de receita, THE API SHALL filtrar todos os agendamentos apenas para aqueles onde professionalId corresponde ao ID do profissional autenticado
2. THE Revenue_Summary_Endpoint SHALL calcular totalRevenue apenas dos agendamentos completados do profissional
3. THE Revenue_Summary_Endpoint SHALL calcular averageTicket apenas com base nos agendamentos do profissional
4. THE Revenue_Summary_Endpoint SHALL calcular lostRevenue apenas dos agendamentos cancelados do profissional
5. THE Revenue_Summary_Endpoint SHALL gerar dailyRevenue agrupado apenas com dados do profissional
6. THE Revenue_Summary_Endpoint SHALL gerar serviceBreakdown apenas com serviços realizados pelo profissional
7. THE Revenue_Summary_Endpoint SHALL gerar staffRanking contendo apenas o profissional autenticado quando a role for professional
8. WHEN um Leader ou Admin acessa relatórios de receita, THE API SHALL retornar dados agregados de todos os profissionais

### Requirement 4: Filtragem de Dados de Weekly Revenue para Professional

**User Story:** Como profissional, eu quero visualizar apenas meu faturamento semanal, para que eu possa acompanhar minha evolução ao longo da semana sem acessar dados de outros profissionais.

#### Acceptance Criteria

1. WHEN um Professional acessa o endpoint de faturamento semanal, THE API SHALL filtrar agendamentos apenas para aqueles onde professionalId corresponde ao ID do profissional autenticado
2. THE Weekly_Revenue_Endpoint SHALL agrupar receita por dia apenas com dados do profissional
3. THE Weekly_Revenue_Endpoint SHALL incluir no resultado apenas o nome do profissional autenticado como chave de agrupamento
4. THE Weekly_Revenue_Endpoint SHALL calcular valores diários apenas com agendamentos confirmed ou completed do profissional
5. WHEN um Leader ou Admin acessa faturamento semanal, THE API SHALL retornar dados de todos os profissionais agrupados por nome

### Requirement 5: Filtragem de Dados de Weekly Cancelled para Professional

**User Story:** Como profissional, eu quero visualizar apenas meus cancelamentos semanais, para que eu possa acompanhar cancelamentos dos meus agendamentos sem acessar dados de outros profissionais.

#### Acceptance Criteria

1. WHEN um Professional acessa o endpoint de cancelamentos semanais, THE API SHALL filtrar agendamentos cancelados apenas para aqueles onde professionalId corresponde ao ID do profissional autenticado
2. THE Weekly_Cancelled_Endpoint SHALL calcular valor total cancelado por dia apenas com agendamentos do profissional
3. THE Weekly_Cancelled_Endpoint SHALL retornar array com 7 dias da semana atual contendo valores de cancelamento do profissional
4. WHEN um Leader ou Admin acessa cancelamentos semanais, THE API SHALL retornar dados agregados de todos os profissionais

### Requirement 6: Controle de Acesso a Listagem de Profissionais

**User Story:** Como profissional, eu quero visualizar apenas meu próprio registro na listagem de profissionais, para que eu possa acessar e editar apenas minhas informações sem visualizar dados de outros profissionais.

#### Acceptance Criteria

1. WHEN um Professional acessa o endpoint de listagem de profissionais, THE API SHALL filtrar a lista para retornar apenas o registro onde id corresponde ao professionalId do usuário autenticado
2. THE Professionals_List_Endpoint SHALL aplicar filtro professionalId automaticamente quando a role for professional
3. THE Professionals_List_Endpoint SHALL respeitar outros filtros (search, unitId) em conjunto com o filtro de professionalId
4. THE Professionals_List_Endpoint SHALL retornar paginação correta considerando apenas o registro do profissional
5. WHEN um Leader ou Admin acessa listagem de profissionais, THE API SHALL retornar todos os profissionais do estabelecimento

### Requirement 7: Controle de Acesso a Detalhes de Profissional

**User Story:** Como profissional, eu quero acessar apenas os detalhes do meu próprio registro, para que eu possa visualizar e editar minhas informações sem acessar dados de outros profissionais.

#### Acceptance Criteria

1. WHEN um Professional acessa o endpoint de detalhes de profissional, THE API SHALL verificar se o ID solicitado corresponde ao professionalId do usuário autenticado
2. IF um Professional tenta acessar detalhes de outro profissional, THEN THE API SHALL retornar erro 403 (FORBIDDEN)
3. THE Professional_Details_Endpoint SHALL retornar dados completos incluindo workingHours apenas se o ID corresponder ao professionalId do usuário
4. WHEN um Leader ou Admin acessa detalhes de profissional, THE API SHALL retornar dados de qualquer profissional do estabelecimento

### Requirement 8: Controle de Acesso a Edição de Profissional

**User Story:** Como profissional, eu quero editar apenas meu próprio registro, para que eu possa atualizar minhas informações sem modificar dados de outros profissionais.

#### Acceptance Criteria

1. WHEN um Professional tenta editar um registro de profissional, THE API SHALL verificar se o ID do registro corresponde ao professionalId do usuário autenticado
2. IF um Professional tenta editar outro profissional, THEN THE API SHALL retornar erro 403 (FORBIDDEN) com mensagem "Profissional só pode editar o próprio registro"
3. THE Professional_Update_Endpoint SHALL permitir atualização de campos (name, avatar, specialties, phone, email, workingHours) apenas para o próprio registro
4. THE Professional_Update_Endpoint SHALL impedir que Professional altere campos sensíveis como shopId ou unitId
5. WHEN um Leader ou Admin edita um profissional, THE API SHALL permitir edição de qualquer profissional do estabelecimento

### Requirement 9: Restrição de Exclusão de Profissional

**User Story:** Como profissional, eu não devo ter permissão para excluir registros de profissionais, para que apenas gestores possam realizar operações de exclusão.

#### Acceptance Criteria

1. THE Professional_Delete_Endpoint SHALL permitir acesso apenas para roles leader e admin
2. IF um Professional tenta acessar o endpoint de exclusão, THEN THE API SHALL retornar erro 403 (FORBIDDEN)
3. THE Middleware_de_Autorização SHALL bloquear requisições DELETE de profissionais antes de processar a lógica de negócio

### Requirement 10: Restrição de Criação de Profissional

**User Story:** Como gestor do sistema, eu quero que apenas Leaders e Admins possam criar novos profissionais, para que o controle de equipe seja centralizado em gestores.

#### Acceptance Criteria

1. THE Professional_Create_Endpoint SHALL permitir acesso apenas para roles leader e admin
2. IF um Professional tenta criar um novo profissional, THEN THE API SHALL retornar erro 403 (FORBIDDEN)
3. THE Middleware_de_Autorização SHALL bloquear requisições POST de profissionais antes de processar a lógica de negócio

### Requirement 11: Criação de Credenciais de Acesso para Profissional

**User Story:** Como leader, eu quero poder criar credenciais de acesso ao painel administrativo ao cadastrar um profissional, para que o profissional possa fazer login e acessar seus próprios dados.

#### Acceptance Criteria

1. WHEN um Leader ou Admin cria um profissional, THE API SHALL aceitar campos opcionais de credenciais (email e password) no payload da requisição
2. IF credenciais forem fornecidas, THEN THE API SHALL criar um registro de User vinculado ao Professional com role "professional"
3. THE Professional_Create_Endpoint SHALL validar que o email fornecido não está em uso por outro usuário
4. THE Professional_Create_Endpoint SHALL fazer hash da senha usando bcrypt antes de armazenar
5. THE Professional_Create_Endpoint SHALL vincular o User ao Professional através do campo professionalId
6. THE Professional_Create_Endpoint SHALL definir automaticamente role como "professional" para o novo usuário
7. IF credenciais não forem fornecidas, THEN THE API SHALL criar apenas o Professional sem criar User associado
8. THE User_Record SHALL conter campos: shopId, name, email, passwordHash, role (professional), professionalId

### Requirement 12: Atualização de Credenciais de Profissional

**User Story:** Como leader, eu quero poder atualizar ou criar credenciais de acesso para um profissional existente, para que eu possa gerenciar o acesso ao sistema de profissionais já cadastrados.

#### Acceptance Criteria

1. WHEN um Leader ou Admin atualiza um profissional, THE API SHALL aceitar campos opcionais de credenciais (email e password) no payload
2. IF o Professional já possui User vinculado, THEN THE API SHALL atualizar o email e/ou senha do User existente
3. IF o Professional não possui User vinculado e credenciais são fornecidas, THEN THE API SHALL criar novo User vinculado ao Professional
4. THE Professional_Update_Endpoint SHALL validar que o novo email não está em uso por outro usuário
5. THE Professional_Update_Endpoint SHALL fazer hash da nova senha antes de atualizar
6. IF apenas email for fornecido sem senha, THEN THE API SHALL atualizar apenas o email mantendo a senha atual

### Requirement 13: Validação de Role no Frontend

**User Story:** Como desenvolvedor frontend, eu quero ter acesso à role do usuário autenticado, para que eu possa adaptar a interface baseado nas permissões do usuário.

#### Acceptance Criteria

1. WHEN um usuário faz login, THE Frontend SHALL armazenar a role do usuário junto com o token JWT
2. THE Auth_Store SHALL incluir campo role com tipo "admin" | "leader" | "professional"
3. THE Auth_Store SHALL expor a role através de um getter ou propriedade acessível
4. THE Frontend SHALL decodificar o JWT token para extrair a role quando necessário
5. THE Frontend SHALL atualizar a role armazenada sempre que um novo token for recebido

### Requirement 14: Adaptação da Interface do Dashboard por Role

**User Story:** Como profissional, eu quero ver uma interface de dashboard adaptada ao meu contexto, para que eu visualize apenas informações relevantes aos meus dados sem confusão com dados de outros profissionais.

#### Acceptance Criteria

1. WHEN um Professional acessa o dashboard, THE Frontend SHALL ocultar filtros de seleção de profissional (staffId)
2. WHEN um Professional acessa o dashboard, THE Frontend SHALL exibir título ou indicador mostrando que os dados são apenas do profissional autenticado
3. WHEN um Leader ou Admin acessa o dashboard, THE Frontend SHALL exibir todos os filtros incluindo seleção de profissional
4. THE Dashboard_Component SHALL verificar a role antes de renderizar componentes de filtro
5. THE Dashboard_Component SHALL adaptar labels e textos para refletir o escopo dos dados (individual vs. estabelecimento)

### Requirement 15: Adaptação da Interface de Revenue por Role

**User Story:** Como profissional, eu quero ver relatórios de receita adaptados ao meu contexto, para que eu visualize apenas meu faturamento sem confusão com dados de outros profissionais.

#### Acceptance Criteria

1. WHEN um Professional acessa a página de revenue, THE Frontend SHALL ocultar filtros de seleção de profissional (staffId)
2. WHEN um Professional acessa a página de revenue, THE Frontend SHALL exibir indicador mostrando que os dados são apenas do profissional autenticado
3. WHEN um Professional visualiza staffRanking, THE Frontend SHALL exibir apenas seu próprio nome e dados
4. WHEN um Leader ou Admin acessa revenue, THE Frontend SHALL exibir todos os filtros e rankings completos
5. THE Revenue_Component SHALL verificar a role antes de renderizar componentes de filtro e ranking

### Requirement 16: Adaptação da Interface de Listagem de Profissionais por Role

**User Story:** Como profissional, eu quero ver apenas meu próprio registro na listagem de profissionais, para que eu possa acessar e editar minhas informações de forma direta.

#### Acceptance Criteria

1. WHEN um Professional acessa a listagem de profissionais, THE Frontend SHALL exibir apenas um registro (o próprio profissional)
2. WHEN um Professional acessa a listagem de profissionais, THE Frontend SHALL ocultar ou desabilitar botão de "Adicionar Profissional"
3. WHEN um Professional visualiza seu registro, THE Frontend SHALL exibir botão de edição normalmente
4. WHEN um Professional visualiza seu registro, THE Frontend SHALL ocultar ou desabilitar botão de exclusão
5. WHEN um Leader ou Admin acessa listagem, THE Frontend SHALL exibir todos os profissionais com botões de adicionar, editar e excluir

### Requirement 17: Controle de Navegação e Menu por Role

**User Story:** Como usuário do sistema, eu quero ver no menu apenas as opções relevantes à minha role, para que eu tenha uma navegação clara e sem opções inacessíveis.

#### Acceptance Criteria

1. THE Navigation_Menu SHALL exibir todas as opções (Dashboard, Revenue, Agenda, Profissionais, Serviços, Clientes, Configurações) para Admin e Leader
2. THE Navigation_Menu SHALL exibir apenas opções permitidas (Dashboard, Revenue, Agenda) para Professional
3. THE Navigation_Menu SHALL ocultar completamente as opções não permitidas (Profissionais, Serviços, Clientes, Configurações) do menu para Professional
4. THE Navigation_Menu SHALL não renderizar links ou itens de menu para rotas restritas quando a role for Professional
5. IF um Professional tenta acessar uma rota restrita diretamente via URL, THEN THE Frontend SHALL redirecionar para página de acesso negado ou dashboard
6. THE Frontend_Router SHALL implementar guards de rota baseados em role

### Requirement 18: Mensagens de Erro Descritivas para Acesso Negado

**User Story:** Como usuário do sistema, eu quero receber mensagens claras quando não tenho permissão para acessar um recurso, para que eu entenda o motivo da restrição.

#### Acceptance Criteria

1. WHEN a API retorna erro 403, THE Frontend SHALL exibir mensagem amigável explicando falta de permissão
2. THE Error_Message SHALL incluir informação sobre qual role é necessária para acessar o recurso
3. THE Error_Message SHALL ser exibida em toast, modal ou componente de erro apropriado
4. THE API SHALL retornar mensagens de erro em português com descrição clara da restrição
5. THE API SHALL incluir no response de erro o campo "code" com valor "FORBIDDEN" para erros de permissão

### Requirement 19: Logging de Tentativas de Acesso Negado

**User Story:** Como administrador do sistema, eu quero que tentativas de acesso não autorizado sejam registradas, para que eu possa monitorar e auditar acessos suspeitos.

#### Acceptance Criteria

1. WHEN um usuário tenta acessar um recurso sem permissão, THE API SHALL registrar log contendo userId, role, endpoint, timestamp
2. THE Logging_System SHALL incluir nível de severidade "WARN" para tentativas de acesso negado
3. THE Logging_System SHALL incluir informações de contexto (IP, user agent) quando disponíveis
4. THE Logging_System SHALL não registrar informações sensíveis (senhas, tokens completos)
5. THE Logs SHALL ser estruturados em formato JSON para facilitar análise

### Requirement 20: Testes de Autorização por Role

**User Story:** Como desenvolvedor do sistema, eu quero ter testes automatizados de autorização, para que eu possa garantir que o controle de acesso funciona corretamente e prevenir regressões.

#### Acceptance Criteria

1. THE Test_Suite SHALL incluir testes unitários para o middleware de autorização
2. THE Test_Suite SHALL incluir testes de integração para cada endpoint protegido verificando acesso por role
3. THE Test_Suite SHALL validar que Professional acessa apenas próprios dados em todos os endpoints
4. THE Test_Suite SHALL validar que Leader e Admin acessam todos os dados do estabelecimento
5. THE Test_Suite SHALL validar que tentativas de acesso não autorizado retornam erro 403
6. THE Test_Suite SHALL validar que filtros de dados são aplicados corretamente por role
7. THE Test_Suite SHALL incluir testes de edge cases (token sem role, role inválida, professionalId ausente)

