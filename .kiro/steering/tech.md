# Tech Stack

## Core Technologies

- **Runtime**: Node.js com TypeScript 5.6
- **Package Manager**: Yarn 4.11 (Berry)
- **Framework**: Express.js 4.21
- **Database**: PostgreSQL 16
- **ORM**: Prisma 5.22
- **Authentication**: JWT (jsonwebtoken v9.0)
- **Password Hashing**: bcrypt v5.1
- **File Storage**: AWS S3 SDK v3.1013 (compatível com Cloudflare R2)
- **Scheduled Jobs**: node-cron v4.2
- **Email**: nodemailer v8.0 (SMTP — boas-vindas e reset de senha)
- **API Documentation**: Swagger (swagger-jsdoc v6.2 + swagger-ui-express v5.0)
- **Testing**: Vitest v2.1 com fast-check v3.23 para property-based testing
- **HTTP Testing**: supertest v7.2

## Development Tools

- **Dev Server**: tsx v4.19 watch para hot reload
- **Build**: TypeScript compiler (tsc)
- **Database Container**: Docker Compose com PostgreSQL 16 Alpine

## TypeScript Configuration

Configurações strict para código de produção:
- `strict: true`
- `target: ES2020`
- `module: CommonJS`
- `esModuleInterop: true`
- Source maps e declarations habilitados
- Output directory: `dist/`

## Common Commands

```bash
# Desenvolvimento
yarn dev                 # Inicia dev server com hot reload (tsx watch src/index.ts)

# Database
yarn prisma:generate     # Gera Prisma Client
yarn prisma:migrate      # Executa migrations em desenvolvimento (prisma migrate dev)

# Build & Produção
yarn build               # prisma generate + prisma migrate deploy + tsc
yarn start               # Inicia servidor de produção (node dist/index.js)

# Testes
yarn test                # Executa testes uma vez (vitest --run)

# Scripts de migração de dados
yarn migrate:slugs       # Migra slugs de unidades (produção)
yarn migrate:slugs:preview  # Dry-run da migração
yarn verify:slugs        # Verifica integridade dos slugs
yarn fix:migration       # Corrige migrations com falha
```

## Environment Variables

Variáveis obrigatórias (ver `.env.example`):

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Authentication
JWT_SECRET=your-secret-key

# Server
PORT=3000
NODE_ENV=development

# File Storage (Cloudflare R2 ou AWS S3)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://your-public-url.com

# CORS
CORS_ORIGIN=http://localhost:8080,http://localhost:5173

# Email (SMTP)
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-user
SMTP_PASS=your-pass
SMTP_FROM_EMAIL=noreply@trinityscheduler.com
SMTP_FROM_NAME=Trinity Scheduler

# URLs
ADMIN_URL=http://localhost:8080
```

> **Nota**: `JWT_EXPIRES_IN` não está implementado no `env.ts` — o token não tem expiração configurada via env.

## Database Setup

Desenvolvimento local usa Docker Compose:

```bash
docker-compose up -d     # Inicia container PostgreSQL
yarn prisma:generate     # Gera Prisma Client
yarn prisma:migrate      # Executa migrations
```

Credenciais padrão (docker-compose.yml):
- Database: `trinity_scheduler`
- User: `trinity`
- Password: `trinity123`
- Port: `5432`
- Host: `localhost`

## API Documentation

Swagger UI disponível em `http://localhost:3000/api-docs` quando o servidor está rodando.

Configuração em `src/config/swagger.ts`:
- OpenAPI 3.0
- JWT Bearer authentication
- Tags agrupadas por domínio (Admin, Client, Public)
- Schemas de request/response
- Documentação de RBAC inline

## Multi-Tenancy

Isolamento de tenant via header:
- **Admin routes**: `Authorization: Bearer <token>` (shopId extraído do JWT)
- **Client routes**: `X-Shop-Id: <shopId>` header obrigatório
- Middleware `tenantFilter` injeta shopId automaticamente nas queries
- Role `admin` bypassa o filtro de tenant (acesso cross-tenant)

## API Structure

- **Base URL**: `http://localhost:3000`
- **Admin Routes**: `/admin/*` (requer JWT)
- **Client Routes**: `/auth/*`, `/services/*`, `/addons/*`, `/professionals/*`, `/availability/*`, `/appointments/*`, `/client/shop/*`, `/client/units/*`
- **Public Routes**: `/public/*` (sem autenticação)
- **API Docs**: `/api-docs`

## Security Features

- JWT-based authentication (sem expiração configurada via env atualmente)
- Password hashing com bcrypt (10 salt rounds)
- Role-based authorization (admin, leader, professional)
- Tenant isolation no nível de middleware
- CORS configurado para origens permitidas
- Sanitização de erros (sem stack traces em produção)
- Logging de tentativas de acesso negado via `logging.service.ts`
