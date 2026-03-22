# Product Overview

Trinity Scheduler Core é a API REST backend que serve tanto o painel administrativo quanto a aplicação cliente do sistema de agendamentos para estabelecimentos de beleza, saúde e bem-estar.

## Core Features

### Admin API (`/admin/*`)

Endpoints protegidos por autenticação JWT para usuários administrativos.

#### Autenticação e Usuários
- Login com email e senha
- Registro de novos estabelecimentos (signup multi-step)
- Reset de senha via token
- Gerenciamento de usuários administrativos
- Sistema de permissões por role (admin, leader, professional)

#### Dashboard e Analytics
- Estatísticas em tempo real (receita, agendamentos, clientes)
- Métricas de crescimento e comparação com períodos anteriores
- Contagem de agendamentos por status
- Total de clientes ativos
- Receita total e por período

#### Gestão de Agendamentos
- CRUD completo de agendamentos
- Filtros avançados (status, data, profissional, serviço, cliente)
- Paginação e ordenação
- Cancelamento com justificativa
- Reagendamento
- Histórico completo por cliente ou profissional
- Status: pending, confirmed, completed, cancelled, no_show

#### Gestão de Clientes
- CRUD completo de clientes
- Perfil detalhado com histórico de agendamentos
- Busca por nome, telefone ou email
- Filtros e paginação
- Soft delete (marcação de exclusão)

#### Gestão de Profissionais (Staff)
- CRUD de profissionais/prestadores
- Configuração de especialidades
- Vinculação com unidades
- Upload de avatar
- Controle de status (ativo/inativo)
- Soft delete
- Vinculação com usuário administrativo (opcional)

#### Catálogo de Serviços
- CRUD de serviços com preço e duração
- Categorização por tipo (service, addon)
- Upload de imagens e ícones
- Descrição detalhada
- Controle de status (ativo/inativo)
- Configuração de disponibilidade

#### Multi-Unidade
- CRUD de unidades físicas
- Configuração de endereço e contato
- Geração automática de slugs únicos para URLs
- Vinculação de profissionais por unidade
- Horários de funcionamento independentes por unidade

#### Relatórios de Receita
- Receita por período (diário, semanal, mensal)
- Distribuição de receita por serviço
- Comparação entre períodos
- Filtros por data, profissional, serviço

#### Configurações do Estabelecimento
- Perfil do estabelecimento (nome, telefone, email, endereço)
- Configuração de nicho/segmento
- Buffer de antecedência mínima para agendamentos
- Horários de funcionamento por dia da semana

#### Upload de Arquivos
- Geração de URLs pré-assinadas para upload direto ao S3/R2
- Upload de imagens de serviços
- Upload de avatares de profissionais
- URLs públicas para acesso aos arquivos

#### Utilitários do Sistema
- Geração de links de agendamento para WhatsApp
- Verificação de saúde do sistema
- Informações de versão

### Client API (`/client/*`)

Endpoints para a aplicação cliente (agendamento online). Requer header `X-Shop-Id` para identificação do estabelecimento.

#### Autenticação
- Autenticação simplificada via telefone
- Criação automática de cliente no primeiro acesso
- Token JWT para sessão

#### Listagem de Recursos
- Listagem de serviços disponíveis (filtro por tipo: service/addon)
- Listagem de profissionais ativos
- Listagem de unidades do estabelecimento
- Informações do estabelecimento (nome, contato, nicho)

#### Disponibilidade
- Consulta de horários disponíveis por profissional e data
- Cálculo automático de slots baseado em:
  - Horários de funcionamento da unidade
  - Duração do serviço
  - Agendamentos existentes
  - Buffer de antecedência mínima

#### Gestão de Agendamentos
- Criação de novos agendamentos
- Listagem de agendamentos do cliente (próximos e histórico)
- Detalhes de agendamento específico
- Cancelamento com justificativa
- Suporte a serviços adicionais (addons)

### Public API (`/public/*`)

Endpoints públicos sem autenticação.

- Health check (`/health`)
- Informações básicas do sistema

## Architecture

### Multi-Tenancy
- Cada estabelecimento (Shop) é completamente isolado via `shopId`
- Isolamento automático no nível de middleware
- Impossibilidade de acesso cross-tenant
- Admin: shopId extraído do JWT
- Client: shopId enviado via header `X-Shop-Id`

### Multi-Unit
- Estabelecimentos podem ter múltiplas unidades físicas
- Cada unidade tem:
  - Endereço e contato próprios
  - Slug único para URLs de agendamento
  - Horários de funcionamento independentes
  - Profissionais vinculados

### Role-Based Access Control (RBAC)
- **Admin**: Acesso completo a todas as funcionalidades
- **Leader**: Gerenciamento de equipe e agendamentos
- **Professional**: Visualização de próprios agendamentos e clientes

### Scheduled Jobs
- Cron jobs via node-cron para tarefas automatizadas:
  - Lembretes de agendamento
  - Limpeza de dados antigos
  - Atualização de status de agendamentos
  - Notificações

## Database Schema

PostgreSQL com Prisma ORM, principais entidades:

- **Shop**: Estabelecimentos (multi-tenant root)
- **User**: Usuários administrativos com roles
- **Professional**: Profissionais/prestadores de serviço
- **Client**: Clientes finais (usuários da aplicação cliente)
- **Service**: Serviços e addons
- **Appointment**: Agendamentos com status e histórico
- **Unit**: Unidades físicas do estabelecimento
- **ShopHour**: Horários de funcionamento por dia da semana
- **ProfessionalAvailability**: Disponibilidade específica de profissionais

Relacionamentos:
- Shop → Users, Professionals, Clients, Services, Units, Appointments
- Professional → Appointments, Unit
- Client → Appointments
- Service → Appointments
- Unit → Professionals, Appointments

## API Documentation

- Swagger/OpenAPI 3.0 disponível em `/api-docs`
- Documentação completa de todos os endpoints
- Schemas de request/response
- Exemplos de uso
- Autenticação JWT documentada

## Error Handling

Respostas de erro padronizadas:
- `400` - VALIDATION_ERROR: Dados inválidos
- `401` - UNAUTHORIZED: Não autenticado
- `403` - FORBIDDEN: Sem permissão
- `404` - NOT_FOUND: Recurso não encontrado
- `409` - CONFLICT: Conflito de dados (ex: horário já ocupado)
- `500` - INTERNAL_ERROR: Erro interno do servidor

Formato de resposta de erro:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Recurso não encontrado"
  }
}
```

## Language

Código e documentação em português (Brasil).
