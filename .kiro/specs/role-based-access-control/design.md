# Design Document: Role-Based Access Control

## Overview

This design implements a comprehensive Role-Based Access Control (RBAC) system for the Trinity Scheduler application. The system enforces access control at multiple layers: backend API middleware, data filtering at the query level, and frontend UI adaptation. The implementation leverages the existing role infrastructure (admin, leader, professional) defined in the database schema and JWT tokens, extending it with proper authorization checks and data isolation.

The RBAC system ensures that:
- **Admins** have unrestricted access to all system features and data
- **Leaders** have full access to their establishment's data and management features
- **Professionals** have restricted access limited to their own data (appointments, revenue, profile)

The design follows a defense-in-depth approach with authorization at the middleware layer, data filtering at the ORM level, and UI adaptation at the presentation layer.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Auth Store (role, token, professionalId)              │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Route Guards (role-based navigation)                  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  UI Components (conditional rendering by role)         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP + JWT Token
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend Layer                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Auth Middleware (JWT verification, user extraction)   │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Authorize Middleware (role validation)                │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Data Filter Layer (professionalId filtering)          │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Route Handlers (business logic)                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Filtered Queries
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL + Prisma ORM                               │ │
│  │  (User, Professional, Appointment, etc.)               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Authorization Flow

```
Request → Auth Middleware → Authorize Middleware → Data Filter → Handler → Response
   │            │                    │                   │            │
   │            ├─ Extract JWT       │                   │            │
   │            ├─ Verify Token      │                   │            │
   │            └─ Set req.user      │                   │            │
   │                                 │                   │            │
   │                                 ├─ Check role       │            │
   │                                 ├─ 403 if denied    │            │
   │                                 └─ Continue         │            │
   │                                                     │            │
   │                                                     ├─ Apply     │
   │                                                     │  filters   │
   │                                                     └─ Query DB  │
   │                                                                  │
   └──────────────────────────────────────────────────────────────────┘
```

### Role Hierarchy and Permissions

```
┌──────────────────────────────────────────────────────────────┐
│                           Admin                               │
│  • Full system access                                         │
│  • Cross-shop visibility (if needed)                          │
│  • All CRUD operations                                        │
│  • User management                                            │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                          Leader                               │
│  • Full shop access                                           │
│  • All professionals' data                                    │
│  • All CRUD operations within shop                            │
│  • Team management                                            │
│  • Create professional credentials                            │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                       Professional                            │
│  • Own data only                                              │
│  • Read own appointments                                      │
│  • Read own revenue                                           │
│  • Update own profile                                         │
│  • No delete operations                                       │
│  • No create operations (except own profile updates)          │
└──────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend Components

#### 1. Authorization Middleware Enhancement

**File:** `src/middlewares/authorize.ts`

**Current Implementation:**
```typescript
export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Não autenticado'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Sem permissão para este recurso'));
    }
    next();
  };
}
```

**Enhancement:** No changes needed - current implementation is sufficient.

#### 2. Data Filter Utility

**New File:** `src/utils/dataFilter.ts`

**Purpose:** Centralized utility for applying role-based data filters to Prisma queries.

**Interface:**
```typescript
interface FilterOptions {
  role: 'admin' | 'leader' | 'professional';
  shopId?: string;
  professionalId?: string;
}

interface AppointmentFilter {
  shopId?: string;
  professionalId?: string;
  [key: string]: unknown;
}

function applyProfessionalFilter(
  baseWhere: Record<string, unknown>,
  options: FilterOptions
): Record<string, unknown>
```

**Responsibilities:**
- Apply professionalId filter when role is 'professional'
- Preserve existing filters (date, unitId, etc.)
- Return modified where clause for Prisma queries

#### 3. Professional Credential Management

**New File:** `src/services/professionalCredentials.service.ts`

**Purpose:** Handle creation and management of User records linked to Professionals.

**Interface:**
```typescript
interface CreateCredentialsInput {
  professionalId: string;
  shopId: string;
  name: string;
  email: string;
  password: string;
}

interface UpdateCredentialsInput {
  professionalId: string;
  email?: string;
  password?: string;
}

async function createProfessionalCredentials(input: CreateCredentialsInput): Promise<User>
async function updateProfessionalCredentials(input: UpdateCredentialsInput): Promise<User>
async function getProfessionalUser(professionalId: string): Promise<User | null>
```

**Responsibilities:**
- Validate email uniqueness
- Hash passwords using bcrypt
- Create User with role='professional'
- Link User to Professional via professionalId
- Handle credential updates

#### 4. Logging Service Enhancement

**File:** `src/services/logging.service.ts` (new)

**Purpose:** Structured logging for security events.

**Interface:**
```typescript
interface AccessDeniedLog {
  userId: string;
  role: string;
  endpoint: string;
  method: string;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

function logAccessDenied(log: AccessDeniedLog): void
```

### Frontend Components

#### 1. Auth Store Enhancement

**File:** `trinity-scheduler-client/src/stores/authStore.ts` (admin panel)

**Current State:**
```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}
```

**Enhanced State:**
```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  role: 'admin' | 'leader' | 'professional' | null;
  professionalId: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
}
```

**New Methods:**
- `hasRole(roles: string[]): boolean` - Check if user has one of the specified roles
- Extract role and professionalId from JWT token on login

#### 2. Route Guard Component

**New File:** `trinity-scheduler-client/src/components/RouteGuard.tsx`

**Purpose:** Protect routes based on user role.

**Interface:**
```typescript
interface RouteGuardProps {
  allowedRoles: ('admin' | 'leader' | 'professional')[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

function RouteGuard({ allowedRoles, children, fallback }: RouteGuardProps): JSX.Element
```

**Behavior:**
- Check if user's role is in allowedRoles
- Render children if authorized
- Render fallback or redirect if not authorized

#### 3. Role-Aware UI Components

**Enhanced Components:**
- `Dashboard.tsx` - Hide professional filter for professionals
- `Revenue.tsx` - Hide professional filter, adapt staffRanking display
- `Professionals.tsx` - Filter list, hide add/delete buttons
- `Navigation.tsx` - Conditionally render menu items

**Pattern:**
```typescript
const { role } = useAuthStore();
const isProfessional = role === 'professional';

return (
  <>
    {!isProfessional && <ProfessionalFilter />}
    {/* Rest of component */}
  </>
);
```

## Data Models

### Existing Schema (No Changes Required)

The current Prisma schema already supports RBAC:

```prisma
model User {
  id             String    @id @default(uuid())
  shopId         String
  name           String
  email          String    @unique
  passwordHash   String
  role           Role      @default(leader)
  professionalId String?   @unique
  // ... other fields
  
  shop         Shop          @relation(fields: [shopId], references: [id])
  professional Professional? @relation(fields: [professionalId], references: [id])
}

enum Role {
  admin
  leader
  professional
}

model Professional {
  id          String    @id @default(uuid())
  shopId      String
  name        String
  // ... other fields
  
  user        User?
  appointments Appointment[]
}
```

**Key Relationships:**
- User.professionalId → Professional.id (one-to-one, optional)
- User.role → Enum (admin, leader, professional)
- Professional.user → User (reverse relation)

### JWT Token Payload

```typescript
interface AuthUser {
  id: string;              // User ID
  shopId: string;          // Shop ID for tenant isolation
  role: 'admin' | 'leader' | 'professional';
  professionalId?: string; // Present only if role is 'professional'
}
```

## API Changes

### Modified Endpoints

#### 1. Dashboard Stats (`GET /admin/dashboard/stats`)

**Current Authorization:** `authorize('leader', 'admin')`
**New Authorization:** `authorize('leader', 'professional', 'admin')`

**Data Filtering Logic:**
```typescript
const where: Record<string, unknown> = { date };
if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

// NEW: Apply professional filter
if (req.user?.role === 'professional' && req.user.professionalId) {
  where.professionalId = req.user.professionalId;
}

if (unitId) where.unitId = unitId;
```

**Response Changes:** None (same structure, filtered data)

#### 2. Weekly Revenue (`GET /admin/dashboard/weekly-revenue`)

**Current Authorization:** `authorize('leader', 'admin')`
**New Authorization:** `authorize('leader', 'professional', 'admin')`

**Data Filtering Logic:**
```typescript
const where: Record<string, unknown> = {
  date: { in: days },
  status: { in: ['confirmed', 'completed'] },
};
if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

// NEW: Apply professional filter
if (req.user?.role === 'professional' && req.user.professionalId) {
  where.professionalId = req.user.professionalId;
}

if (unitId) where.unitId = unitId;
```

**Response Changes:** For professionals, only their name appears in the result

#### 3. Weekly Cancelled (`GET /admin/dashboard/weekly-cancelled`)

**Current Authorization:** `authorize('leader', 'admin')`
**New Authorization:** `authorize('leader', 'professional', 'admin')`

**Data Filtering:** Same pattern as weekly-revenue

#### 4. Revenue Summary (`GET /admin/revenue/summary`)

**Current Authorization:** `authorize('leader', 'admin')`
**New Authorization:** `authorize('leader', 'professional', 'admin')`

**Data Filtering:**
```typescript
const where: Record<string, unknown> = {};
if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

// NEW: Apply professional filter
if (req.user?.role === 'professional' && req.user.professionalId) {
  where.professionalId = req.user.professionalId;
}

// Existing filters
if (unitId) where.unitId = unitId;
if (staffId) where.professionalId = staffId; // Overrides professional filter if provided
if (startDate || endDate) {
  where.date = {
    ...(startDate ? { gte: startDate } : {}),
    ...(endDate ? { lte: endDate } : {}),
  };
}
```

**Response Changes:** staffRanking contains only the professional when role is 'professional'

#### 5. Professionals List (`GET /admin/professionals`)

**Current Authorization:** `authorize('leader', 'professional', 'admin')`
**No Change**

**Data Filtering:**
```typescript
const where: Record<string, unknown> = { deletedAt: null };
if (shopId && req.user?.role !== 'admin') where.shopId = shopId;

// NEW: Apply professional filter
if (req.user?.role === 'professional' && req.user.professionalId) {
  where.id = req.user.professionalId;
}

// Existing filters (unitId, search) applied after
```

#### 6. Professional Details (`GET /admin/professionals/:id`)

**Current Authorization:** `authorize('leader', 'professional', 'admin')`
**No Change**

**Access Control:**
```typescript
const { id } = req.params;

// NEW: Check if professional is accessing their own record
if (req.user?.role === 'professional' && req.user.professionalId !== id) {
  throw new AppError(403, 'FORBIDDEN', 'Profissional só pode acessar o próprio registro');
}

const where: Record<string, unknown> = { id, deletedAt: null };
if (shopId && req.user?.role !== 'admin') where.shopId = shopId;
```

#### 7. Professional Update (`PUT /admin/professionals/:id`)

**Current Implementation:** Already has professional check
**No Changes Required**

#### 8. Professional Create (`POST /admin/professionals`)

**Current Authorization:** `authorize('leader', 'admin')`
**No Change**

**New Feature:** Accept optional credentials in request body

**Request Body Enhancement:**
```typescript
interface CreateProfessionalRequest {
  name: string;
  unitId?: string;
  avatar?: string;
  specialties?: string[];
  phone?: string;
  email?: string;
  active?: boolean;
  workingHours?: WorkingHour[];
  // NEW: Optional credentials
  credentials?: {
    email: string;
    password: string;
  };
}
```

**Implementation:**
```typescript
const { credentials, ...professionalData } = req.body;

// Create professional
const professional = await prisma.professional.create({
  data: { ...professionalData, shopId }
});

// Create user credentials if provided
if (credentials) {
  await createProfessionalCredentials({
    professionalId: professional.id,
    shopId,
    name: professional.name,
    email: credentials.email,
    password: credentials.password
  });
}
```

#### 9. Professional Update with Credentials (`PUT /admin/professionals/:id`)

**Request Body Enhancement:**
```typescript
interface UpdateProfessionalRequest {
  name?: string;
  // ... existing fields
  // NEW: Optional credentials update
  credentials?: {
    email?: string;
    password?: string;
  };
}
```

**Implementation:**
```typescript
const { credentials, ...professionalData } = req.body;

// Update professional
const professional = await prisma.professional.update({
  where: { id },
  data: professionalData
});

// Update or create credentials if provided
if (credentials) {
  const existingUser = await getProfessionalUser(id);
  if (existingUser) {
    await updateProfessionalCredentials({
      professionalId: id,
      ...credentials
    });
  } else {
    await createProfessionalCredentials({
      professionalId: id,
      shopId: professional.shopId,
      name: professional.name,
      email: credentials.email!,
      password: credentials.password!
    });
  }
}
```

### Frontend API Integration

**Admin Panel API Client Enhancement:**

```typescript
// src/lib/api.ts (admin panel)
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  id: string;
  shopId: string;
  role: 'admin' | 'leader' | 'professional';
  professionalId?: string;
}

export function decodeToken(token: string): DecodedToken {
  return jwtDecode<DecodedToken>(token);
}
```

## Error Handling

### Error Response Format

All authorization errors follow the standard format:

```typescript
{
  error: {
    code: 'FORBIDDEN',
    message: 'Sem permissão para este recurso'
  }
}
```

### Specific Error Messages

| Scenario | HTTP Status | Code | Message |
|----------|-------------|------|---------|
| No authentication | 401 | UNAUTHORIZED | Não autenticado |
| Invalid role | 403 | FORBIDDEN | Sem permissão para este recurso |
| Professional accessing other's data | 403 | FORBIDDEN | Profissional só pode acessar próprios dados |
| Professional editing other's profile | 403 | FORBIDDEN | Profissional só pode editar o próprio registro |
| Email already in use | 409 | CONFLICT | Email já está em uso |
| Professional not found | 404 | NOT_FOUND | Profissional não encontrado |

### Frontend Error Handling

```typescript
try {
  await api.get('/admin/professionals/other-id');
} catch (error) {
  if (error.status === 403) {
    toast.error('Você não tem permissão para acessar este recurso');
  } else {
    toast.error('Erro ao carregar dados');
  }
}
```

## Testing Strategy

### Backend Testing

#### Unit Tests

**Middleware Tests** (`src/middlewares/__tests__/authorize.test.ts`):
- Test authorize middleware with valid roles
- Test authorize middleware with invalid roles
- Test authorize middleware without authentication
- Test role extraction from JWT

**Data Filter Tests** (`src/utils/__tests__/dataFilter.test.ts`):
- Test professional filter application
- Test filter preservation (existing filters not overwritten)
- Test admin/leader bypass (no professional filter)
- Test edge cases (missing professionalId, null values)

**Credential Service Tests** (`src/services/__tests__/professionalCredentials.test.ts`):
- Test credential creation with valid data
- Test credential creation with duplicate email
- Test credential update (email only, password only, both)
- Test credential creation for existing user
- Test password hashing

#### Integration Tests

**Dashboard Routes** (`src/routes/admin/__tests__/dashboard.routes.test.ts`):
- Professional sees only own data in stats
- Professional sees only own name in weekly revenue
- Leader sees all professionals' data
- Admin sees all data
- Professional cannot access other professional's data

**Revenue Routes** (`src/routes/admin/__tests__/revenue.routes.test.ts`):
- Professional sees only own revenue in summary
- Professional sees only self in staffRanking
- Leader sees all professionals' revenue
- Filters work correctly with professional role

**Professional Routes** (`src/routes/admin/__tests__/professionals.routes.test.ts`):
- Professional can list only own record
- Professional can view only own details
- Professional can update only own record
- Professional cannot delete any record
- Professional cannot create new professionals
- Leader can create professional with credentials
- Leader can update professional credentials
- Email uniqueness validation works

#### Property-Based Tests

**Authorization Properties** (`src/__tests__/properties/authorization.test.ts`):


Property 1: Professional data isolation
*For any* professional user and any endpoint that returns appointments, the returned data should only include appointments where professionalId matches the user's professionalId

Property 2: Role-based endpoint access
*For any* endpoint with role restrictions, a request with an unauthorized role should return 403 FORBIDDEN

Property 3: Professional self-access only
*For any* professional user attempting to access professional details, access should succeed only when the requested professionalId equals the user's professionalId

Property 4: Credential email uniqueness
*For any* attempt to create or update professional credentials, if the email already exists for a different user, the operation should fail with 409 CONFLICT

Property 5: Password hashing
*For any* credential creation or password update, the stored passwordHash should never equal the plaintext password

### Frontend Testing

#### Unit Tests

**Auth Store Tests** (`src/stores/__tests__/authStore.test.ts`):
- Test role extraction from token
- Test hasRole method with various roles
- Test professionalId extraction
- Test logout clears role and professionalId

**Route Guard Tests** (`src/components/__tests__/RouteGuard.test.tsx`):
- Test renders children for authorized role
- Test renders fallback for unauthorized role
- Test redirects for unauthorized access
- Test multiple allowed roles

#### Integration Tests

**Dashboard Component** (`src/pages/__tests__/Dashboard.test.tsx`):
- Professional sees no professional filter
- Professional sees indicator of personal data
- Leader sees all filters
- Data fetching uses correct filters based on role

**Revenue Component** (`src/pages/__tests__/Revenue.test.tsx`):
- Professional sees no professional filter
- Professional sees only self in ranking
- Leader sees full ranking

**Professionals Component** (`src/pages/__tests__/Professionals.test.tsx`):
- Professional sees only own record
- Professional sees no add button
- Professional sees no delete button
- Leader sees all records and all buttons

**Navigation Component** (`src/components/__tests__/Navigation.test.tsx`):
- Professional sees limited menu items
- Leader sees all menu items
- Professional cannot access restricted routes

#### Property-Based Tests

**UI Adaptation Properties** (`src/__tests__/properties/uiAdaptation.test.ts`):

Property 6: Professional UI restrictions
*For any* component that displays professional-specific controls, when the user role is 'professional', those controls should not be rendered

Property 7: Navigation consistency
*For any* route in the application, if a professional role cannot access it via API, the navigation menu should not display a link to that route

### Test Configuration

All property-based tests should run with minimum 100 iterations:

```typescript
import fc from 'fast-check';

describe('Authorization Properties', () => {
  it('Property 1: Professional data isolation', () => {
    fc.assert(
      fc.property(
        fc.record({
          professionalId: fc.uuid(),
          appointments: fc.array(fc.record({
            id: fc.uuid(),
            professionalId: fc.uuid()
          }))
        }),
        async ({ professionalId, appointments }) => {
          // Test implementation
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Test Tags:**
Each property test must include a comment tag:
```typescript
// Feature: role-based-access-control, Property 1: Professional data isolation
```

### Manual Testing Checklist

- [ ] Login as professional and verify dashboard shows only own data
- [ ] Login as professional and verify cannot access other professional's profile
- [ ] Login as professional and verify menu shows only allowed items
- [ ] Login as leader and create professional with credentials
- [ ] Login as leader and update professional credentials
- [ ] Login with professional credentials and verify access works
- [ ] Attempt to access restricted route as professional via URL
- [ ] Verify 403 errors show appropriate messages
- [ ] Verify logging captures access denied attempts
- [ ] Test all three roles (admin, leader, professional) on each endpoint

## Implementation Approach

### Phase 1: Backend Authorization Infrastructure

1. **Create Data Filter Utility**
   - Implement `src/utils/dataFilter.ts`
   - Add unit tests
   - Document usage patterns

2. **Create Professional Credentials Service**
   - Implement `src/services/professionalCredentials.service.ts`
   - Add email uniqueness validation
   - Add password hashing
   - Add unit tests

3. **Create Logging Service**
   - Implement `src/services/logging.service.ts`
   - Add structured logging for access denied events
   - Integrate with existing error handler

### Phase 2: Backend Route Modifications

4. **Update Dashboard Routes**
   - Add 'professional' to authorize middleware
   - Apply professional data filter
   - Add integration tests
   - Verify response structure unchanged

5. **Update Revenue Routes**
   - Add 'professional' to authorize middleware
   - Apply professional data filter
   - Adapt staffRanking for professionals
   - Add integration tests

6. **Update Professional Routes**
   - Add access control checks for details endpoint
   - Add credential creation to POST endpoint
   - Add credential update to PUT endpoint
   - Add integration tests

### Phase 3: Frontend Auth Infrastructure

7. **Enhance Auth Store**
   - Add role and professionalId fields
   - Add hasRole method
   - Extract data from JWT on login
   - Add unit tests

8. **Create Route Guard Component**
   - Implement RouteGuard component
   - Add role checking logic
   - Add redirect/fallback handling
   - Add unit tests

### Phase 4: Frontend UI Adaptation

9. **Update Dashboard Component**
   - Hide professional filter for professionals
   - Add personal data indicator
   - Add integration tests

10. **Update Revenue Component**
    - Hide professional filter for professionals
    - Adapt staffRanking display
    - Add integration tests

11. **Update Professionals Component**
    - Filter list for professionals
    - Hide add/delete buttons for professionals
    - Add integration tests

12. **Update Navigation Component**
    - Conditionally render menu items
    - Add route guards to protected routes
    - Add integration tests

### Phase 5: Testing and Documentation

13. **Property-Based Tests**
    - Implement all 7 correctness properties
    - Run with 100+ iterations
    - Tag with feature and property references

14. **Integration Testing**
    - Test all role combinations
    - Test all endpoints with different roles
    - Test UI adaptation for all roles

15. **Documentation**
    - Update API documentation with role requirements
    - Document credential creation flow
    - Add examples for each role
    - Update Swagger annotations

### Phase 6: Deployment and Monitoring

16. **Database Migration** (if needed)
    - No schema changes required
    - Verify existing User-Professional relationships

17. **Logging and Monitoring**
    - Deploy logging service
    - Set up alerts for repeated access denied attempts
    - Monitor authorization errors

18. **Rollout**
    - Deploy backend changes
    - Deploy frontend changes
    - Monitor error rates
    - Verify no regressions

## Security Considerations

### Defense in Depth

1. **Middleware Layer:** Role validation before request processing
2. **Data Layer:** Automatic filtering at query level
3. **UI Layer:** Hide unauthorized features from view

### Audit Trail

All access denied attempts are logged with:
- User ID and role
- Requested endpoint and method
- Timestamp
- IP address and user agent (when available)

### Token Security

- JWT tokens contain minimal data (id, shopId, role, professionalId)
- Tokens expire after 7 days
- No sensitive data in tokens
- Token verification on every request

### Password Security

- Passwords hashed with bcrypt (10 salt rounds)
- Plaintext passwords never stored
- Password validation on credential creation
- Secure password reset flow (existing)

### Data Isolation

- Professional users cannot access other professionals' data
- Filters applied at database query level
- No client-side filtering for security-critical data
- Tenant isolation maintained (shopId filtering)

## Performance Considerations

### Query Optimization

- Professional filters add minimal overhead (indexed professionalId)
- No additional database queries for role checking
- Filters combined with existing where clauses

### Caching Strategy

- JWT tokens cached in frontend (localStorage)
- Role information cached with token
- No additional API calls for role verification

### Frontend Performance

- Conditional rendering has negligible performance impact
- Route guards execute synchronously
- No additional network requests for UI adaptation

## Monitoring and Observability

### Metrics to Track

- Authorization failures by endpoint
- Authorization failures by role
- Credential creation success/failure rate
- Professional login success rate
- Access denied events per user

### Logging

All security events logged with structured format:

```json
{
  "level": "WARN",
  "event": "ACCESS_DENIED",
  "userId": "uuid",
  "role": "professional",
  "endpoint": "/admin/professionals/other-id",
  "method": "GET",
  "timestamp": "2025-01-15T10:30:00Z",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

### Alerts

Set up alerts for:
- Repeated access denied from same user (potential attack)
- Spike in 403 errors (potential misconfiguration)
- Failed credential creation (potential issue)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

