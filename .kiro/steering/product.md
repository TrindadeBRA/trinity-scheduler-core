# Product Overview

Trinity Scheduler Core é a API REST backend que serve tanto o painel administrativo quanto a aplicação cliente do sistema de agendamentos.

## Core Features

### Admin API (`/admin/*`)
- Autenticação JWT para usuários administrativos
- CRUD completo de clientes, profissionais, serviços e unidades
- Gerenciamento de agendamentos
- Dashboard com estatísticas e métricas
- Relatórios de receita
- Upload de imagens (AWS S3/Cloudflare R2)
- Configuração de horários de funcionamento
- Sistema de permissões por role (admin, leader, professional)

### Client API (`/client/*`)
- Autenticação simplificada via telefone
- Listagem de serviços e profissionais disponíveis
- Consulta de disponibilidade de horários
- Criação e cancelamento de agendamentos
- Histórico de agendamentos do cliente
- Suporte a serviços adicionais (addons)

## Architecture

- Multi-tenant: Cada estabelecimento (Shop) é isolado via `shopId`
- Multi-unit: Estabelecimentos podem ter múltiplas unidades físicas
- Role-based access control (RBAC)
- Scheduled jobs via node-cron para tarefas automatizadas

## Database

PostgreSQL com Prisma ORM, incluindo:
- Shops (estabelecimentos)
- Users (usuários administrativos)
- Professionals (profissionais/prestadores)
- Clients (clientes finais)
- Services (serviços e addons)
- Appointments (agendamentos)
- Units (unidades físicas)
- Working hours (horários de trabalho)

## Documentation

Swagger/OpenAPI disponível em `/api-docs`

## Language

Código e documentação em português (Brasil).
