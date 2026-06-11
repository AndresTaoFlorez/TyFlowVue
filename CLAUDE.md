# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with hot reload
npm run build     # Production build
npm run preview   # Preview production build locally
```

No test or lint commands are configured.

## Architecture

Vue 3 + Vite user management dashboard with a Python REST API backend (Litestar + Supabase). The UI is in Spanish. Clean Architecture with four layers.

### Stack
- **Vue 3** with Composition API (`<script setup>`)
- **Pinia** for state management
- **Vue Router** with auth guards
- **Axios** for HTTP requests to the REST API
- **Boxicons** via CDN for icons
- Custom CSS with design tokens (no CSS framework)

### Key directories (Clean Architecture)
- `src/domain/entities/` — Domain entities (User, Role, Area)
- `src/domain/errors/` — Domain error classes
- `src/infrastructure/http/` — Axios HTTP client singleton with interceptors
- `src/infrastructure/repositories/` — API data access (UserRepository, RoleRepository, AreaRepository)
- `src/application/use-cases/` — Business use cases (auth, users, roles, areas)
- `src/presentation/views/` — Page components (LoginView, DashboardView, UsersView)
- `src/presentation/layouts/` — MainLayout (sidebar + topbar + content area)
- `src/presentation/stores/` — Pinia stores (useAuthStore, useUserStore)
- `src/presentation/components/` — Reusable UI components
- `src/router/` — Route definitions with `requiresAuth` meta and navigation guards
- `src/styles/` — Design tokens, CSS reset, and utility styles

### Data flow
```
View → Store → UseCase → Repository → HTTP Client → REST API
```

### Routing
- `/` — LoginView (public)
- `/app/*` — Protected routes (require auth)
  - `/app/dashboard` — DashboardView
  - `/app/users` — UsersView
  - `/app/profile` — ProfileView

### Route imports: static vs lazy-load
- **Static imports** for protected views (MainLayout, DashboardView, UsersView, ProfileView): these are always needed after login, so they load with the main bundle. This avoids race conditions when navigating quickly between routes (lazy chunks can get cancelled mid-load).
- **Lazy imports** (`() => import(...)`) only for public views (LoginView, ForgotPasswordView, ResetPasswordView): an authenticated user never needs them, so they stay out of the main bundle.
- **Rule:** when adding a new protected view, import it statically. Only lazy-load views that belong to a different auth context.

### Auth flow
1. Login via `POST /auth/login` → receives `access_token` + `refresh_token`
2. Tokens stored in `localStorage` (`tyflow_token`, `tyflow_refresh_token`)
3. Axios interceptor attaches `Authorization: Bearer` header to all requests
4. On 401, interceptor attempts token refresh via `POST /auth/refresh`
5. On app load (`main.js`), JWT is decoded synchronously and `fetchProfile()` is awaited before mounting — this ensures `isAdmin`, sidebar items, and profile data are ready on first render
6. Inactive users are auto-logged out
7. Router guard redirects based on `isAuthenticated` computed property

### API Endpoints (backend at VITE_API_URL)
- `POST /auth/login` — Authenticate, returns tokens
- `POST /auth/refresh` — Refresh expired token
- `GET /users` — List all users (dashboard view with roles/areas)
- `GET /users/:id` — Get user by UUID
- `POST /users` — Create user profile
- `PATCH /users/:id/status` — Toggle user active/inactive
- `GET /roles` — List all roles
- `GET /areas` — List all areas

## Building pages/menus (shell boards contract)

The shell (AppTopbar + AppSidebar) is a fixed chassis with contextual outlets. Views publish content into them via `<TopbarBoard>` / `<SidebarBoard>` (Teleport), and declare main-area treatment via `route.meta.mainMode`/`dense`. **Read `UI_BOARDS.md` before creating or restructuring any page/menu** — it is the manual for the contract (recipe, per-board style rules, gotchas, reference consumers).

## Conventions

- **Path alias:** `@` maps to `src/` (configured in vite.config.js and jsconfig.json)
- **CSS variables:** Primary color `--primary-500: #2AC78F`; full palette in `src/styles/tokens.css`
- **Naming:** PascalCase components, BEM-inspired CSS classes, `useXxxStore()` for Pinia
- **Error messages:** API errors are mapped to Spanish user-facing messages in views
- **Commit messages:** Written in Spanish
- **Environment:** `VITE_API_URL` in `.env` points to the backend API base URL
