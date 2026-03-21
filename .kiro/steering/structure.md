# Project Structure

## Root Directory

```
trinity-scheduler-core/
├── src/                    # Source code
├── prisma/                 # Prisma schema and migrations
├── dist/                   # Compiled JavaScript output
├── docs/                   # Documentation
├── .kiro/                  # Kiro configuration and specs
├── docker-compose.yml      # PostgreSQL container setup
└── node_modules/           # Dependencies
```

## Source Directory (`src/`)

```
src/
├── routes/                 # API route handlers
│   ├── admin/             # Admin panel routes (/admin/*)
│   │   ├── auth.routes.ts
│   │   ├── appointments.routes.ts
│   │   ├── clients.routes.ts
│   │   ├── professionals.routes.ts
│   │   ├── services.routes.ts
│   │   ├── units.routes.ts
│   │   ├── dashboard.routes.ts
│   │   ├── revenue.routes.ts
│   │   ├── shop.routes.ts
│   │   ├── upload.routes.ts
│   │   └── system.routes.ts
│   ├── client/            # Client app routes (/client/*)
│   │   ├── auth.routes.ts
│   │   ├── appointments.routes.ts
│   │   ├── services.routes.ts
│   │   ├── addons.routes.ts
│   │   ├── professionals.routes.ts
│   │   ├── availability.routes.ts
│   │   └── shop.routes.ts
│   └── index.ts           # Route mounting
├── services/              # Business logic services
│   ├── appointment.service.ts
│   ├── availability.service.ts
│   └── cron.service.ts
├── middlewares/           # Express middlewares
│   ├── auth.ts           # JWT authentication
│   ├── authorize.ts      # Role-based authorization
│   ├── shopResolver.ts   # Multi-tenant shop resolution
│   ├── tenantFilter.ts   # Tenant data isolation
│   └── errorHandler.ts   # Global error handling
├── utils/                 # Utility functions
│   ├── prisma.ts         # Prisma client instance
│   ├── jwt.ts            # JWT token utilities
│   ├── password.ts       # Password hashing
│   ├── errors.ts         # Custom error classes
│   ├── pagination.ts     # Pagination helpers
│   └── r2.ts             # Cloudflare R2/S3 client
├── config/                # Configuration
│   ├── env.ts            # Environment variables
│   ├── constants.ts      # Application constants
│   └── swagger.ts        # Swagger/OpenAPI config
├── types/                 # TypeScript type definitions
│   └── express.d.ts      # Express request extensions
├── app.ts                 # Express app setup
└── index.ts               # Application entry point
```

## Key Conventions

### Route Organization

Routes are separated by consumer:
- **Admin Routes** (`/admin/*`): Require JWT authentication, full CRUD operations
- **Client Routes** (`/client/*`): Require `X-Shop-Id` header, read-heavy operations

### Service Layer

Business logic is extracted into services in `src/services/`:
- Named as `{entity}.service.ts` (e.g., `appointment.service.ts`)
- Handle complex operations, calculations, and business rules
- Called by route handlers

### Middleware Chain

Typical middleware flow:
1. `cors()` - CORS handling
2. `express.json()` - Body parsing
3. `shopResolver` - Extract and validate shopId (client routes)
4. `authMiddleware` - Verify JWT token (admin routes)
5. `authorize([roles])` - Check user role (admin routes)
6. `tenantFilter` - Apply tenant isolation to Prisma queries
7. Route handler
8. `errorHandler` - Global error handling

### Database Access

- Use `prisma` instance from `utils/prisma.ts`
- Always filter by `shopId` for multi-tenant isolation
- Use `tenantFilter` middleware to automatically inject shopId filters
- Prisma schema located in `prisma/schema.prisma`

### Error Handling

Use `AppError` class from `utils/errors.ts`:
```typescript
throw new AppError(404, 'NOT_FOUND', 'Recurso não encontrado');
```

Error codes:
- `400` - VALIDATION_ERROR
- `401` - UNAUTHORIZED
- `403` - FORBIDDEN
- `404` - NOT_FOUND
- `409` - CONFLICT
- `500` - INTERNAL_ERROR

### Authentication & Authorization

- **Admin**: JWT token in `Authorization: Bearer <token>` header
  - Token contains: `{ userId, shopId, role }`
  - Roles: `admin`, `leader`, `professional`
- **Client**: `X-Shop-Id` header for tenant identification
  - No authentication required for most read operations
  - Phone-based auth for creating/managing appointments

### File Upload

- Uses AWS S3 SDK configured for Cloudflare R2
- Presigned URLs for secure uploads
- Public URLs for accessing uploaded files
- Utility functions in `utils/r2.ts`

### Scheduled Jobs

Cron jobs defined in `services/cron.service.ts`:
- Initialized on server start
- Used for automated tasks (e.g., appointment reminders, cleanup)

### API Documentation

- Swagger annotations in route files using JSDoc comments
- Swagger spec generated in `config/swagger.ts`
- Accessible at `/api-docs` endpoint

### Naming Conventions

- **Routes**: `{entity}.routes.ts` (e.g., `appointments.routes.ts`)
- **Services**: `{entity}.service.ts` (e.g., `appointment.service.ts`)
- **Middlewares**: camelCase (e.g., `authMiddleware`, `shopResolver`)
- **Utils**: camelCase (e.g., `verifyToken`, `hashPassword`)
- **Types**: PascalCase for interfaces/types

### Multi-Tenancy Pattern

1. Client sends `X-Shop-Id` header or JWT with shopId
2. `shopResolver` middleware validates and attaches to `req.shopId`
3. `tenantFilter` middleware ensures all Prisma queries filter by shopId
4. Route handlers access `req.shopId` for tenant-specific operations

### Testing

- Unit tests co-located with source files or in dedicated test directories
- Property-based tests using fast-check
- Run with `yarn test`
