# TYFLOW

TyFlow is a delivery management platform designed to help teams organize, assign, and track distribution operations efficiently. It provides a centralized dashboard where administrators can manage users, roles, and work areas — keeping the entire operation visible and under control.

## WHAT IT DOES

- **User Management** — Create, activate/deactivate, and organize team members with assigned roles and areas.
- **Role & Area Assignment** — Define operational roles (e.g., Administrator, Specialist) and work areas (e.g., Support, Sales) to structure your team.
- **Secure Authentication** — Login with email/password, session recovery, and self-service password reset via email.
- **Admin Dashboard** — A clean, real-time view of your team and operations.

## GETTING STARTED

```bash
npm install
npm run dev
```

Create a `.env` file with:

```
VITE_API_URL=http://localhost:8181
```

## DEPLOYMENT

The app deploys automatically to the production server via GitHub Actions on every push to `main`.

Required GitHub configuration (Settings → Secrets and Variables → Actions):

**Secrets:** `SSH_HOST`, `SSH_USER`, `SSH_KEY`

**Variables:** `VITE_API_URL`

## BUILT WITH

- Vue 3
- Pinia
- Vue Router
- Axios
