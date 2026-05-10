## Context
TyFlowVue is a Vue 3 SPA in its current broken state. Read the full tree before touching anything.

## Current problems to solve
- src/api/supabase.js is the only data layer — must be replaced entirely
- src/components/ is full of Vue scaffold garbage (HelloWorld, TheWelcome, WelcomeItem, icons/) — delete all of it
- src/assets/ has no token system, just raw CSS — replace with architecture-compliant styles
- src/stores/auth.js calls Supabase directly — must call API instead
- No domain layer, no infrastructure layer, no use cases, no repositories
- src/views/UsersView.vue calls Supabase directly — must go through the full stack
- prompts/ folder is application content, not source code — leave it where it is
- .claude_instructions/ is already correct — do not touch it

## Step 1 — Delete scaffold garbage first
Delete these files entirely, they have zero production value:
- src/components/HelloWorld.vue
- src/components/TheWelcome.vue
- src/components/WelcomeItem.vue
- src/components/icons/ (entire folder)
- src/assets/base.css
- src/assets/logo.svg

## Step 2 — Build the target folder structure
Reorganize src/ to match this exact layout:

src/
├── domain/
│   ├── entities/
│   │   ├── User.js
│   │   ├── Role.js
│   │   └── Area.js
│   └── errors/
│       └── DomainErrors.js
├── infrastructure/
│   ├── http/
│   │   ├── client.js          ← singleton Axios instance
│   │   └── ApiError.js
│   └── repositories/
│       ├── UserRepository.js
│       ├── RoleRepository.js
│       └── AreaRepository.js
├── application/
│   └── use-cases/
│       ├── auth/
│       │   ├── LoginUseCase.js
│       │   └── LogoutUseCase.js
│       ├── users/
│       │   ├── FetchUsersUseCase.js
│       │   ├── FetchUserByIdUseCase.js
│       │   ├── CreateUserUseCase.js
│       │   └── ToggleUserStatusUseCase.js
│       ├── roles/
│       │   └── FetchRolesUseCase.js
│       └── areas/
│           └── FetchAreasUseCase.js
├── presentation/
│   ├── views/
│   │   ├── LoginView.vue
│   │   ├── DashboardView.vue
│   │   └── UsersView.vue
│   ├── components/
│   │   └── (empty for now, created on demand)
│   ├── layouts/
│   │   └── MainLayout.vue
│   └── stores/
│       ├── useAuthStore.js
│       └── useUserStore.js
├── router/
│   └── index.js
├── styles/
│   ├── tokens.css
│   ├── reset.css
│   └── utilities.css
├── App.vue
└── main.js

## Step 3 — Infrastructure layer

### src/infrastructure/http/client.js
- Axios singleton
- baseURL from import.meta.env.VITE_API_URL
- Request interceptor: read token from localStorage key 'tyflow_token',
  attach as Authorization: Bearer {token} on every request
- Response interceptor:
  - 401 → clear token + redirect to login route
  - 403 → redirect to /forbidden
  - any error → throw new ApiError(status, message from response.data.detail)

### src/infrastructure/http/ApiError.js
Class with: status (number), message (string), endpoint (string).
This is the only error type that leaves the infrastructure layer.

### src/infrastructure/repositories/UserRepository.js
Methods: getAll(), getById(id), create(dto), toggleStatus(id, status)
Each method:
- Calls the HTTP client
- Maps response data to User domain entity
- Catches ApiError, re-throws as typed DomainError (UserNotFoundError etc.)
- Never returns raw axios response

Same pattern for RoleRepository and AreaRepository.

## Step 4 — Domain layer

### src/domain/entities/
Plain frozen JS objects. No Vue imports. No Axios imports.
- User: { id, firstName, lastName, documentNumber, email, status, roles, areas }
- Role: { id, name }
- Area: { id, name }

### src/domain/errors/DomainErrors.js
- DomainError (base, extends Error)
- UserNotFoundError
- RoleNotFoundError
- AreaNotFoundError
- UnauthorizedError
- NetworkError

## Step 5 — Application layer
Each use case is a plain async function or class that:
- Receives repository instances as parameters
- Calls repository methods
- Returns domain entities
- Never imports Axios or Vue

## Step 6 — Pinia stores

### src/presentation/stores/useAuthStore.js
- State: token (string|null), currentUser (User|null), isAuthenticated (computed)
- login action: calls LoginUseCase → stores token in localStorage + state
- logout action: calls LogoutUseCase → clears localStorage + state
- initAuth action: reads token from localStorage, calls GET /auth/me to restore session
- Zero Supabase imports

### src/presentation/stores/useUserStore.js
- State: users[], isLoading, error
- Actions call use cases, wire repositories inside the action scope

## Step 7 — Router
- All imports are lazy (dynamic import) — no static view imports
- Auth guard reads from useAuthStore only
- Routes:
  / → LoginView (no auth required)
  /app → MainLayout wrapper (requiresAuth: true)
  /app/dashboard → DashboardView
  /app/users → UsersView

## Step 8 — Styles
Replace src/assets/main.css with the three-file system in src/styles/:
- tokens.css: all CSS custom properties (colors, spacing, typography, radii, shadows)
- reset.css: box model, base font, remove defaults — uses tokens
- utilities.css: .sr-only only
main.js imports them in order: tokens → reset → utilities

## Step 9 — Environment
.env:
VITE_API_URL=http://localhost:8000

Remove VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
After confirming everything works, uninstall @supabase/supabase-js:
npm uninstall @supabase/supabase-js

## Architecture rules (absolute)
- Views call stores only — never use cases, never repositories, never HTTP client
- Stores call use cases only — never repositories directly, never HTTP client
- Use cases call repositories only — never HTTP client directly
- Repositories call HTTP client only
- Domain entities have zero external imports
- ApiError never reaches a Vue component
- Every component class name follows BEM in templates

## Deliverables
- Full file path for every created or modified file
- After restructure: run npm run dev, confirm login works end to end
- Confirm zero console errors on: login, dashboard load, users page load