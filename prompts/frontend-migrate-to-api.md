## Context
TyFlowVue is a Vue 3 SPA (Composition API, Pinia, Vue Router).
Currently it calls Supabase directly from stores and components.
The backend bd_tyflow (Litestar API) is now the single source of truth.

## Goal
Remove every direct Supabase dependency from TyFlowVue and replace it
with a clean HTTP client layer that talks exclusively to the Litestar API.

## Step 1 — Audit before touching anything
Read every .vue, .js file in src/.
Find and list:
- Every import from @supabase/supabase-js
- Every supabase.from(), supabase.auth, supabase.rpc() call
- Every file that imports src/api/supabase.js or src/infrastructure/api/supabase.js
Report: file path, line number, what it does, what API endpoint replaces it.
Wait for confirmation before Step 2.

## Step 2 — Build the new infrastructure layer
Replace the Supabase client with a typed HTTP client targeting the Litestar API.

### src/infrastructure/http/client.js
- Single Axios (or native fetch) instance
- Base URL from VITE_API_URL env variable
- Request interceptor: attach Bearer token from auth store on every request
- Response interceptor: catch 401 (redirect to login), 403 (redirect to forbidden),
  5xx (throw ApiError with message from response body)
- Never instantiated more than once (singleton)

### src/infrastructure/http/ApiError.js
Typed error class: status code, message, endpoint that failed.
This is the only error type that crosses from infrastructure to application.

### src/infrastructure/repositories/
One repository file per domain aggregate:
- UserRepository.js     → wraps GET/POST/PATCH /users endpoints
- RoleRepository.js     → wraps GET /roles endpoints
- AreaRepository.js     → wraps GET /areas endpoints

Each repository method:
- Receives plain input (ids, DTOs)
- Calls the HTTP client
- Maps the API response to a Domain Entity
- Catches ApiError and re-throws as a typed DomainError
- Never returns raw API response objects to the application layer

## Step 3 — Build the domain layer
### src/domain/entities/
Plain JavaScript objects (or frozen classes) with no framework dependency.
- User.js    → id, fullName, email, documentNumber, status, roles[], areas[]
- Role.js    → id, name
- Area.js    → id, name

### src/domain/errors/
- DomainError (base)
- UserNotFoundError
- UnauthorizedError
- NetworkError

## Step 4 — Update the application layer
### src/application/use-cases/
Each use case receives repositories via parameter (no direct imports).
- FetchUsersUseCase.js
- FetchUserByIdUseCase.js
- CreateUserUseCase.js
- ToggleUserStatusUseCase.js
- FetchRolesUseCase.js
- FetchAreasUseCase.js

Use cases return Domain Entities, never raw API objects.

## Step 5 — Update Pinia stores
Stores call use cases only. Zero HTTP calls, zero Supabase calls.
Wire repositories into use cases inside the store action scope.
State holds Domain Entities, not API response shapes.

## Step 6 — Update auth flow
Replace supabase.auth.signInWithPassword with POST /auth/login to the Litestar API.
Replace supabase.auth.signOut with POST /auth/logout.
Replace supabase.auth.getSession with GET /auth/session or read JWT from localStorage.
The auth store manages the token and exposes isAuthenticated and currentUser.
The router guard reads from the auth store only — never calls Supabase.

## Step 7 — Environment
.env:
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are removed entirely.

## Step 8 — Delete
After all replacements are confirmed working:
- Delete src/infrastructure/api/supabase.js (or src/api/supabase.js)
- Remove @supabase/supabase-js from package.json
- Run npm install to clean lockfile

## Architecture rules (never violate)
- Components call stores only
- Stores call use cases only
- Use cases call repositories only
- Repositories call the HTTP client only
- Domain entities have zero framework imports
- ApiError never reaches a Vue component — it is caught and converted
  to a DomainError in the repository layer

## Deliverable
Show full file path for every new or modified file.
After Step 8, run the dev server and confirm zero console errors on login,
dashboard load, and users/roles/areas page load.