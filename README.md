# Kronuz Core (API)

Backend da plataforma Kronuz — API REST em Express + TypeScript com Prisma ORM.

## Stack

- Node.js ≥ 22.12
- Express 4
- Prisma 5 + PostgreSQL
- Yarn 4
- TypeScript 5
- JWT para autenticação
- Cloudflare R2 (S3-compatible) para uploads
- Nodemailer para emails
- Swagger para documentação da API
- Asaas para pagamentos

## Setup

```bash
# Instalar dependências
yarn install

# Copiar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Gerar Prisma Client
yarn prisma:generate

# Rodar migrations
yarn prisma:migrate

# Iniciar em dev
yarn dev
```

## Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string do PostgreSQL |
| `JWT_SECRET` | Chave secreta para tokens JWT |
| `PORT` | Porta da API (default: 3000) |
| `NODE_ENV` | `development` ou `production` |
| `R2_ACCOUNT_ID` | Cloudflare R2 Account ID |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 Access Key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 Secret Key |
| `R2_BUCKET_NAME` | Nome do bucket R2 |
| `R2_PUBLIC_URL` | URL pública do bucket R2 |
| `SMTP_HOST` | Host do servidor SMTP |
| `SMTP_PORT` | Porta SMTP |
| `SMTP_USER` | Usuário SMTP |
| `SMTP_PASS` | Senha SMTP |
| `SMTP_FROM_EMAIL` | Email remetente |
| `SMTP_FROM_NAME` | Nome remetente |
| `ADMIN_URL` | URL do painel admin (usada em emails e callbacks) |
| `SEED_ADMIN_EMAIL` | Email do primeiro admin (seed) |
| `SEED_ADMIN_PASSWORD` | Senha do primeiro admin (seed) |
| `ASAAS_API_KEY` | API Key do Asaas |
| `ASAAS_BASE_URL` | URL base da API Asaas |

## Scripts

| Comando | Descrição |
|---|---|
| `yarn dev` | Inicia servidor em modo dev com hot-reload |
| `yarn build` | Gera Prisma, roda migrations, seed e compila TS |
| `yarn start` | Inicia servidor compilado (produção) |
| `yarn test` | Roda testes com Vitest |
| `yarn prisma:generate` | Gera Prisma Client |
| `yarn prisma:migrate` | Cria nova migration |
| `yarn prisma:studio` | Abre Prisma Studio |
| `yarn db:reset` | Reseta banco de dados |

## Deploy (Coolify)

Build Command:
```
yarn build
```

Start Command:
```
yarn start
```

Variável extra para o Nixpacks:
```
NIXPACKS_NODE_VERSION=22.12.0
```
