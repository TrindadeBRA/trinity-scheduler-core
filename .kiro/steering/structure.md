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
│   │   ├── auth.routes.ts           # Login, register, password reset
│   │   ├── appointments.routes.ts   # Appointment CRUD
│   │   ├── clients.routes.ts        # Client management
│   │   ├── professionals.routes.ts  # Professional/staff management
│   │   ├── services.routes.ts       # Service catalog management
│   │   ├── units.routes.ts          # Unit management
│   │   ├── dashboard.routes.ts      # Dashboard statistics
│   │   ├── revenue.routes.ts        # Revenue reports
│   │   ├── shop.routes.ts           # Shop configuration
│   │   ├── upload.routes.ts         # File upload (presigned URLs)
│   │   ├── system.routes.ts         # System utilities
│   │   └── __tests__/               # Route tests
│   ├── client/            # Client app routes (/client/*)
│   │   ├── auth.routes.ts           # Phone-based authentication
│   │   ├── appointments.routes.ts   # Appointment creation/cancellation
│   │   ├── services.routes.ts       # Service listing
│   │   ├── addons.routes.ts         # Addon services
│   │   ├── professionals.routes.ts  # Professional listing
│   │   ├── availability.routes.ts   # Available time slots
│   │   ├── shop.routes.ts           # Shop information
│   │   └── units.routes.ts          # Unit listing
│   ├── public.routes.ts   # Public routes (health check, etc.)
│   └── index.ts           # Route mounting and registration
├── services/              # Business logic services
│   ├── appointment.service.ts   # Appointment business logic
│   ├── availability.service.ts  # Availability calculation
│   └── cron.service.ts          # Scheduled jobs (reminders, cleanup)
├── middlewares/           # Express middlewares
│   ├── auth.ts           # JWT authentication and token verification
│   ├── authorize.ts      # Role-based authorization (admin, leader, professional)
│   ├── shopResolver.ts   # Multi-tenant shop resolution from headers
│   ├── tenantFilter.ts   # Automatic tenant data isolation for Prisma
│   └── errorHandler.ts   # Global error handling and formatting
├── utils/                 # Utility functions
│   ├── prisma.ts         # Prisma client singleton instance
│   ├── jwt.ts            # JWT token generation and verification
│   ├── password.ts       # Password hashing and comparison (bcrypt)
│   ├── errors.ts         # Custom error classes (AppError)
│   ├── pagination.ts     # Pagination helpers and metadata
│   ├── r2.ts             # Cloudflare R2/S3 client and presigned URLs
│   ├── slug.ts           # URL slug generation and validation
│   └── slug.test.ts      # Slug utility tests
├── config/                # Configuration
│   ├── env.ts            # Environment variable validation and export
│   ├── constants.ts      # Application constants (roles, statuses, etc.)
│   └── swagger.ts        # Swagger/OpenAPI configuration
├── types/                 # TypeScript type definitions
│   └── express.d.ts      # Express request extensions (shopId, userId, role)
├── app.ts                 # Express app setup (middlewares, routes, error handling)
└── index.ts               # Application entry point (server start, cron init)
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

Typical middleware flow for requests:

**Admin Routes:**
1. `cors()` - CORS handling with allowed origins
2. `express.json()` - Body parsing
3. `authMiddleware` - Verify JWT token, extract userId, shopId, role
4. `authorize([roles])` - Check user role (admin, leader, professional)
5. `tenantFilter` - Apply tenant isolation to Prisma queries
6. Route handler - Execute business logic
7. `errorHandler` - Global error handling and response formatting

**Client Routes:**
1. `cors()` - CORS handling
2. `express.json()` - Body parsing
3. `shopResolver` - Extract and validate shopId from `X-Shop-Id` header
4. `tenantFilter` - Apply tenant isolation to Prisma queries
5. Route handler - Execute business logic
6. `errorHandler` - Global error handling

**Public Routes:**
1. `cors()` - CORS handling
2. `express.json()` - Body parsing
3. Route handler - Execute business logic
4. `errorHandler` - Global error handling

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

- **Unit Tests**: Co-located with source files (e.g., `slug.test.ts`, `units.routes.test.ts`)
- **Property-Based Tests**: Using fast-check for correctness properties
- **Test Framework**: Vitest v2.1 with Node.js test environment
- **Test Commands**: 
  - `yarn test` - Run all tests once
  - Tests are located in `__tests__/` directories or co-located with source files
- **Coverage**: Tests cover critical business logic, utilities, and route handlers
