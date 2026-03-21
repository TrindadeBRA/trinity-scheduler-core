# Tech Stack

## Core Technologies

- **Runtime**: Node.js with TypeScript 5
- **Package Manager**: Yarn 4 (Berry)
- **Framework**: Express.js 4
- **Database**: PostgreSQL 16
- **ORM**: Prisma 5.22
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **File Storage**: AWS S3 SDK (compatible with Cloudflare R2)
- **Scheduled Jobs**: node-cron
- **API Documentation**: Swagger (swagger-jsdoc + swagger-ui-express)
- **Testing**: Vitest with fast-check for property-based testing

## Development Tools

- **Dev Server**: tsx watch for hot reload
- **Build**: TypeScript compiler (tsc)
- **Database Container**: Docker Compose with PostgreSQL 16 Alpine

## TypeScript Configuration

Strict TypeScript settings for production-grade code:
- `strict: true`
- `target: ES2020`
- `module: CommonJS`
- Source maps and declarations enabled

## Common Commands

```bash
# Development
yarn dev                 # Start dev server with hot reload (tsx watch)

# Database
yarn prisma:generate     # Generate Prisma Client
yarn prisma:migrate      # Run migrations in development

# Building & Production
yarn build               # Generate Prisma Client + run migrations + compile TypeScript
yarn start               # Start production server (node dist/index.js)

# Testing
yarn test                # Run tests once (Vitest)
```

## Environment Variables

Required environment variables (see `.env.example`):

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Authentication
JWT_SECRET=your-secret-key

# Server
PORT=3000
NODE_ENV=development

# File Storage (Cloudflare R2 or AWS S3)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

## Database Setup

Local development uses Docker Compose:

```bash
docker-compose up -d     # Start PostgreSQL container
yarn prisma:migrate      # Run migrations
```

Default credentials:
- Database: `trinity_scheduler`
- User: `trinity`
- Password: `trinity123`
- Port: `5432`

## API Documentation

Swagger UI available at `http://localhost:3000/api-docs` when server is running.

## Multi-Tenancy

The API uses header-based tenant isolation:
- Admin routes: `Authorization: Bearer <token>` (shopId extracted from JWT)
- Client routes: `X-Shop-Id: <shopId>` header required
