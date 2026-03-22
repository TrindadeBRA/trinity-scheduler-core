# Tech Stack

## Core Technologies

- **Runtime**: Node.js with TypeScript 5.6
- **Package Manager**: Yarn 4.11 (Berry)
- **Framework**: Express.js 4.21
- **Database**: PostgreSQL 16
- **ORM**: Prisma 5.22
- **Authentication**: JWT (jsonwebtoken v9.0)
- **Password Hashing**: bcrypt v5.1
- **File Storage**: AWS S3 SDK v3.1013 (compatible with Cloudflare R2)
- **Scheduled Jobs**: node-cron v4.2
- **API Documentation**: Swagger (swagger-jsdoc v6.2 + swagger-ui-express v5.0)
- **Testing**: Vitest v2.1 with fast-check v3.23 for property-based testing

## Development Tools

- **Dev Server**: tsx v4.19 watch for hot reload
- **Build**: TypeScript compiler (tsc)
- **Database Container**: Docker Compose with PostgreSQL 16 Alpine
- **Migration Scripts**: Custom scripts for data migrations and slug generation

## TypeScript Configuration

Strict TypeScript settings for production-grade code:
- `strict: true`
- `target: ES2020`
- `module: CommonJS`
- `esModuleInterop: true`
- Source maps and declarations enabled
- Output directory: `dist/`

## Common Commands

```bash
# Development
yarn dev                 # Start dev server with hot reload (tsx watch src/index.ts)

# Database
yarn prisma:generate     # Generate Prisma Client
yarn prisma:migrate      # Run migrations in development (prisma migrate dev)

# Building & Production
yarn build               # Pre-migrate + generate Prisma Client + deploy migrations + compile TypeScript
yarn start               # Start production server (node dist/index.js)

# Testing
yarn test                # Run tests once (vitest --run)

# Data Migration Scripts
yarn migrate:slugs       # Migrate unit slugs (production)
yarn migrate:slugs:preview  # Dry-run migration preview
yarn verify:slugs        # Verify slug integrity
yarn fix:migration       # Fix failed migrations
```

## Environment Variables

Required environment variables (see `.env.example`):

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=development

# File Storage (Cloudflare R2 or AWS S3)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://your-public-url.com

# CORS
CORS_ORIGIN=http://localhost:8080,http://localhost:5173
```

## Database Setup

Local development uses Docker Compose:

```bash
docker-compose up -d     # Start PostgreSQL container
yarn prisma:generate     # Generate Prisma Client
yarn prisma:migrate      # Run migrations
```

Default credentials (docker-compose.yml):
- Database: `trinity_scheduler`
- User: `trinity`
- Password: `trinity123`
- Port: `5432`
- Host: `localhost`

## API Documentation

Swagger UI available at `http://localhost:3000/api-docs` when server is running.

Swagger configuration includes:
- OpenAPI 3.0 specification
- JWT Bearer authentication scheme
- Grouped routes by tags (Admin, Client, Public)
- Request/response schemas
- Error response examples

## Multi-Tenancy

The API uses header-based tenant isolation:
- **Admin routes**: `Authorization: Bearer <token>` (shopId extracted from JWT payload)
- **Client routes**: `X-Shop-Id: <shopId>` header required for all requests
- Middleware automatically filters database queries by shopId
- Prevents cross-tenant data access

## API Structure

- **Base URL**: `http://localhost:3000`
- **Admin Routes**: `/admin/*` (requires JWT authentication)
- **Client Routes**: `/client/*` (requires X-Shop-Id header)
- **Public Routes**: `/public/*` (no authentication required)
- **Health Check**: `/health`
- **API Docs**: `/api-docs`

## Security Features

- JWT-based authentication with expiration
- Password hashing with bcrypt (10 salt rounds)
- Role-based authorization (admin, leader, professional)
- Tenant isolation at middleware level
- CORS configuration for allowed origins
- Error sanitization (no stack traces in production)
