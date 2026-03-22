# Implementation Plan: Role-Based Access Control

## Overview

This implementation plan converts the RBAC design into actionable coding tasks. The implementation follows a phased approach: backend authorization infrastructure, backend route modifications, frontend auth infrastructure, frontend UI adaptation, and testing. Each task builds incrementally, ensuring that code is integrated and functional at each step.

The system implements role-based access control for three roles (admin, leader, professional) with defense-in-depth security: middleware authorization, data filtering at the query level, and UI adaptation. Professional users see only their own data across all endpoints.

## Tasks

- [ ] 1. Backend Authorization Infrastructure
  - [x] 1.1 Create data filter utility for role-based query filtering
    - Create `src/utils/dataFilter.ts` with `applyProfessionalFilter` function
    - Implement logic to add professionalId filter when role is 'professional'
    - Preserve existing filters (date, unitId, etc.) in the where clause
    - Export TypeScript interfaces: `FilterOptions`, `AppointmentFilter`
    - _Requirements: 1.5, 1.6_
  
  - [ ]* 1.2 Write unit tests for data filter utility
    - Test professional filter application with various base filters
    - Test filter preservation (existing filters not overwritten)
    - Test admin/leader bypass (no professional filter applied)
    - Test edge cases (missing professionalId, null values)
    - _Requirements: 20.6_
  
  - [x] 1.3 Create professional credentials service
    - Create `src/services/professionalCredentials.service.ts`
    - Implement `createProfessionalCredentials` function with email validation and password hashing
    - Implement `updateProfessionalCredentials` function for updating email/password
    - Implement `getProfessionalUser` function to retrieve User by professionalId
    - Export TypeScript interfaces: `CreateCredentialsInput`, `UpdateCredentialsInput`
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 12.2, 12.3, 12.4, 12.5, 12.6_
  
  - [ ]* 1.4 Write unit tests for professional credentials service
    - Test credential creation with valid data
    - Test credential creation with duplicate email (409 CONFLICT)
    - Test credential update (email only, password only, both)
    - Test password hashing (plaintext never stored)
    - _Requirements: 20.7_
  
  - [x] 1.5 Create logging service for security events
    - Create `src/services/logging.service.ts`
    - Implement `logAccessDenied` function with structured JSON logging
    - Include userId, role, endpoint, method, timestamp, IP, user agent
    - Use WARN severity level for access denied events
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [ ] 2. Backend Dashboard Route Modifications
  - [x] 2.1 Update dashboard stats endpoint for professional access
    - Modify `src/routes/admin/dashboard.routes.ts` GET `/dashboard/stats`
    - Add 'professional' to authorize middleware roles
    - Apply professional filter using data filter utility when role is 'professional'
    - Preserve existing filters (date, unitId, shopId)
    - _Requirements: 1.1, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [ ]* 2.2 Write property test for dashboard stats data isolation
    - **Property 1: Professional data isolation**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
    - Test that professional users only see their own appointment data
    - Use fast-check to generate random professionalId and appointment data
    - Verify returned stats only include appointments matching professionalId
    - _Requirements: 20.3_
  
  - [x] 2.3 Update weekly revenue endpoint for professional access
    - Modify `src/routes/admin/dashboard.routes.ts` GET `/dashboard/weekly-revenue`
    - Add 'professional' to authorize middleware roles
    - Apply professional filter when role is 'professional'
    - Ensure only professional's name appears in result for professionals
    - _Requirements: 1.1, 1.5, 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 2.4 Update weekly cancelled endpoint for professional access
    - Modify `src/routes/admin/dashboard.routes.ts` GET `/dashboard/weekly-cancelled`
    - Add 'professional' to authorize middleware roles
    - Apply professional filter when role is 'professional'
    - Calculate cancelled values only for professional's appointments
    - _Requirements: 1.1, 1.5, 5.1, 5.2, 5.3, 5.4_
  
  - [ ]* 2.5 Write integration tests for dashboard routes
    - Test professional sees only own data in stats
    - Test professional sees only own name in weekly revenue
    - Test leader sees all professionals' data
    - Test 403 error when professional tries to access other's data
    - _Requirements: 20.3, 20.4_

- [ ] 3. Backend Revenue Route Modifications
  - [x] 3.1 Update revenue summary endpoint for professional access
    - Modify `src/routes/admin/revenue.routes.ts` GET `/revenue/summary`
    - Add 'professional' to authorize middleware roles
    - Apply professional filter to all appointment queries
    - Ensure staffRanking contains only professional when role is 'professional'
    - Handle staffId filter override correctly
    - _Requirements: 1.1, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  
  - [ ]* 3.2 Write property test for revenue data isolation
    - **Property 1: Professional data isolation (revenue)**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
    - Test that professional users only see their own revenue data
    - Verify staffRanking contains only the professional's record
    - _Requirements: 20.3_
  
  - [ ]* 3.3 Write integration tests for revenue routes
    - Test professional sees only own revenue in summary
    - Test professional sees only self in staffRanking
    - Test leader sees all professionals' revenue
    - Test filters work correctly with professional role
    - _Requirements: 20.3, 20.4_

- [ ] 4. Backend Professional Route Modifications
  - [x] 4.1 Update professionals list endpoint for professional access
    - Modify `src/routes/admin/professionals.routes.ts` GET `/professionals`
    - Apply professional filter when role is 'professional' (filter by id)
    - Preserve existing filters (search, unitId, pagination)
    - Ensure pagination works correctly with single record
    - _Requirements: 1.1, 1.5, 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x] 4.2 Update professional details endpoint with access control
    - Modify `src/routes/admin/professionals.routes.ts` GET `/professionals/:id`
    - Add check: if role is 'professional' and id !== professionalId, return 403
    - Return error message: "Profissional só pode acessar o próprio registro"
    - _Requirements: 1.1, 1.2, 7.1, 7.2, 7.3, 7.4_
  
  - [ ]* 4.3 Write property test for professional self-access only
    - **Property 3: Professional self-access only**
    - **Validates: Requirements 7.1, 7.2**
    - Test that professional can access own details (id === professionalId)
    - Test that professional cannot access other professional's details (403)
    - _Requirements: 20.3_
  
  - [x] 4.4 Add credential creation to professional create endpoint
    - Modify `src/routes/admin/professionals.routes.ts` POST `/professionals`
    - Accept optional `credentials` field in request body (email, password)
    - Call `createProfessionalCredentials` if credentials provided
    - Handle email uniqueness validation (409 CONFLICT)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_
  
  - [x] 4.5 Add credential update to professional update endpoint
    - Modify `src/routes/admin/professionals.routes.ts` PUT `/professionals/:id`
    - Accept optional `credentials` field in request body
    - Check if User exists for professional, update or create accordingly
    - Call `updateProfessionalCredentials` or `createProfessionalCredentials`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  
  - [ ]* 4.6 Write property test for credential email uniqueness
    - **Property 4: Credential email uniqueness**
    - **Validates: Requirements 11.3, 12.4**
    - Test that duplicate email returns 409 CONFLICT
    - Test that unique email succeeds
    - _Requirements: 20.7_
  
  - [ ]* 4.7 Write property test for password hashing
    - **Property 5: Password hashing**
    - **Validates: Requirements 11.4, 12.5**
    - Test that stored passwordHash never equals plaintext password
    - Test that bcrypt hash is verifiable
    - _Requirements: 20.7_
  
  - [ ]* 4.8 Write integration tests for professional routes
    - Test professional can list only own record
    - Test professional can view only own details
    - Test professional can update only own record
    - Test professional cannot delete any record (403)
    - Test professional cannot create new professionals (403)
    - Test leader can create professional with credentials
    - Test leader can update professional credentials
    - _Requirements: 20.3, 20.4, 20.5_

- [x] 5. Checkpoint - Backend Implementation Complete
  - Ensure all backend tests pass
  - Verify all endpoints return correct data for each role
  - Test authorization middleware blocks unauthorized access
  - Ask the user if questions arise

- [ ] 6. Frontend Auth Store Enhancement
  - [x] 6.1 Enhance auth store with role and professionalId
    - Locate admin panel auth store (likely in admin panel codebase)
    - Add `role` field: `'admin' | 'leader' | 'professional' | null`
    - Add `professionalId` field: `string | null`
    - Extract role and professionalId from JWT token on login
    - Implement `hasRole(roles: string[]): boolean` method
    - Update logout to clear role and professionalId
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  
  - [ ]* 6.2 Write unit tests for auth store
    - Test role extraction from JWT token
    - Test hasRole method with various roles
    - Test professionalId extraction
    - Test logout clears role and professionalId
    - _Requirements: 20.1_

- [ ] 7. Frontend Route Guard Component
  - [x] 7.1 Create RouteGuard component for role-based routing
    - Create route guard component in admin panel
    - Accept `allowedRoles` prop: array of allowed roles
    - Check if user's role is in allowedRoles
    - Render children if authorized, fallback/redirect if not
    - _Requirements: 17.5, 17.6_
  
  - [ ]* 7.2 Write unit tests for RouteGuard
    - Test renders children for authorized role
    - Test renders fallback for unauthorized role
    - Test redirects for unauthorized access
    - Test multiple allowed roles
    - _Requirements: 20.2_

- [ ] 8. Frontend Dashboard UI Adaptation
  - [x] 8.1 Adapt dashboard component for professional role
    - Locate dashboard component in admin panel
    - Hide professional filter (staffId) when role is 'professional'
    - Add indicator showing data is personal when role is 'professional'
    - Adapt labels and texts for individual vs. establishment scope
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [ ]* 8.2 Write integration tests for dashboard component
    - Test professional sees no professional filter
    - Test professional sees personal data indicator
    - Test leader sees all filters
    - Test data fetching uses correct filters based on role
    - _Requirements: 20.4_

- [ ] 9. Frontend Revenue UI Adaptation
  - [x] 9.1 Adapt revenue component for professional role
    - Locate revenue component in admin panel
    - Hide professional filter (staffId) when role is 'professional'
    - Add indicator showing data is personal when role is 'professional'
    - Adapt staffRanking display to show only self for professionals
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [ ]* 9.2 Write integration tests for revenue component
    - Test professional sees no professional filter
    - Test professional sees only self in ranking
    - Test leader sees full ranking
    - _Requirements: 20.4_

- [ ] 10. Frontend Professionals UI Adaptation
  - [x] 10.1 Adapt professionals list component for professional role
    - Locate professionals list component in admin panel
    - Hide or disable "Add Professional" button when role is 'professional'
    - Hide or disable delete button for professional's own record
    - Ensure edit button is visible for professional's own record
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_
  
  - [ ]* 10.2 Write integration tests for professionals component
    - Test professional sees only own record
    - Test professional sees no add button
    - Test professional sees no delete button
    - Test leader sees all records and all buttons
    - _Requirements: 20.4_

- [ ] 11. Frontend Navigation UI Adaptation
  - [x] 11.1 Adapt navigation menu for professional role
    - Locate navigation component in admin panel
    - Show all menu items (Dashboard, Revenue, Agenda, Profissionais, Serviços, Clientes, Configurações) for admin and leader
    - Show only allowed items (Dashboard, Revenue, Agenda) for professional
    - Hide restricted items (Profissionais, Serviços, Clientes, Configurações) for professional
    - Add route guards to protected routes
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_
  
  - [ ]* 11.2 Write property test for navigation consistency
    - **Property 7: Navigation consistency**
    - **Validates: Requirements 17.1, 17.2, 17.3, 17.4**
    - Test that if professional cannot access route via API, navigation doesn't show link
    - _Requirements: 20.7_
  
  - [ ]* 11.3 Write integration tests for navigation component
    - Test professional sees limited menu items
    - Test leader sees all menu items
    - Test professional cannot access restricted routes
    - _Requirements: 20.4_

- [ ] 12. Frontend Error Handling for Authorization
  - [x] 12.1 Implement user-friendly error messages for 403 errors
    - Locate error handling in admin panel API client
    - Display friendly message when API returns 403
    - Include information about required role in error message
    - Use toast, modal, or error component for display
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [x] 13. Checkpoint - Frontend Implementation Complete
  - Ensure all frontend tests pass
  - Verify UI adapts correctly for each role
  - Test route guards block unauthorized navigation
  - Test error messages display correctly
  - Ask the user if questions arise

- [ ] 14. Property-Based Testing
  - [ ]* 14.1 Write property test for role-based endpoint access
    - **Property 2: Role-based endpoint access**
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - Test that unauthorized role returns 403 for any restricted endpoint
    - Use fast-check to generate random roles and endpoints
    - _Requirements: 20.2, 20.5_
  
  - [ ]* 14.2 Write property test for professional UI restrictions
    - **Property 6: Professional UI restrictions**
    - **Validates: Requirements 14.1, 14.2, 15.1, 15.2, 16.2, 16.4**
    - Test that professional-specific controls are not rendered for professional role
    - _Requirements: 20.6_

- [ ] 15. Integration Testing and Documentation
  - [ ]* 15.1 Write end-to-end integration tests for all roles
    - Test complete flow for admin role (all access)
    - Test complete flow for leader role (shop access)
    - Test complete flow for professional role (own data only)
    - Test cross-role scenarios (professional trying to access leader features)
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_
  
  - [x] 15.2 Add logging integration to authorization middleware
    - Integrate logging service with authorize middleware
    - Log access denied events with full context
    - Include IP and user agent from request headers
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_
  
  - [x] 15.3 Update Swagger documentation with complete RBAC rules
    - Update Swagger annotations for all modified endpoints (dashboard, revenue, professionals)
    - Document role requirements for each endpoint (admin, leader, professional)
    - Document automatic data filtering applied by role (professionalId filter for professionals)
    - Add examples showing request/response for each role
    - Document credential creation flow in POST/PUT /professionals endpoints
    - Document all authorization error responses (401, 403) with codes and messages
    - Include security scheme documentation for JWT with role claim
    - Add notes about data isolation and filtering behavior per role
    - _Requirements: 18.4, 18.5_

- [ ] 16. Create RBAC Steering File
  - [x] 16.1 Create steering file with RBAC rules and guidelines
    - Create `trinity-scheduler-core/.kiro/steering/rbac-rules.md`
    - Document the three roles (admin, leader, professional) and their permissions
    - Document automatic data filtering rules (professionalId filter for professionals)
    - Document authorization patterns for new endpoints
    - Include code examples for applying role-based filters
    - Include examples of using authorize middleware with multiple roles
    - Document credential creation pattern for professionals
    - Include security best practices (defense-in-depth, data isolation)
    - Add front-matter with `inclusion: auto` for automatic inclusion
    - Document common pitfalls and how to avoid them
    - _Requirements: All requirements (comprehensive reference)_

- [x] 17. Final Checkpoint - All Tests Pass
  - Run all unit tests and verify they pass
  - Run all property-based tests with 100+ iterations
  - Run all integration tests and verify they pass
  - Verify no regressions in existing functionality
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Implementation uses TypeScript throughout (backend and frontend)
- Backend uses Express.js with Prisma ORM
- Frontend uses React with Zustand for state management
- All code should follow existing project conventions and structure
