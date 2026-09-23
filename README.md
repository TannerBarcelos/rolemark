# RoleMark

A TanStack Start app with self-hosted authentication via [Better Auth](https://www.better-auth.com)
(Google sign-in), Drizzle ORM, and Postgres.

## Setup

```bash
bun install
cp .env.example .env        # then fill in the values
docker compose up -d        # local Postgres on :5432
bun run db:migrate          # create auth tables
bun --bun run dev
```

### Google OAuth client

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).
2. Authorized JavaScript origin: `http://localhost:3000`
3. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy the client ID/secret into `.env`. Add the production origin/redirect URI when you deploy.

## Auth layout

| Path                            | Purpose                                                           |
| ------------------------------- | ----------------------------------------------------------------- |
| `src/lib/auth.server.ts`        | Better Auth instance (server only)                                |
| `src/lib/auth-client.ts`        | Browser client (`authClient.signIn.social`, `authClient.signOut`) |
| `src/lib/auth.functions.ts`     | `getSession` server fn and `authMiddleware` for server functions  |
| `src/routes/api/auth/$.ts`      | Mounts Better Auth's endpoints at `/api/auth/*`                   |
| `src/routes/_authenticated.tsx` | Route guard; anything under `_authenticated/` requires a session  |
| `src/db/schema.ts`              | Auth tables (regenerate with `bun run auth:generate`)             |

Route guards only protect pages. Every server function that touches user data must use
`authMiddleware` as well.

## Database scripts

- `bun run auth:generate` — regenerate `src/db/schema.ts` after changing Better Auth config/plugins
- `bun run db:generate` — create a SQL migration from schema changes
- `bun run db:migrate` — apply migrations
- `bun run db:studio` — browse the database

Build the production app with `bun --bun run build`.
