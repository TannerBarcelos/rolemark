# RoleMark

A TanStack Start app on Cloudflare Workers with self-hosted authentication via
[Better Auth](https://www.better-auth.com) (Google sign-in), Drizzle ORM, and Postgres through
Cloudflare Hyperdrive.

## Setup

```bash
bun install
cp .env.example .env        # then fill in the values
docker compose up -d        # local Postgres on :5432
bun run db:migrate          # create auth tables
bun run dev                 # runs the Worker locally in workerd
```

### Google OAuth client

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).
2. Authorized JavaScript origin: `http://localhost:3000`
3. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy the client ID/secret into `.env`. Add the production origin/redirect URI when you deploy.

## Auth layout

| Path                            | Purpose                                                                |
| ------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/auth.ts`               | `createAuth(db, env)`: Better Auth config (Google, account linking)    |
| `src/lib/auth.server.ts`        | `getAuth()` / `getDb()`: per-request instances built from Worker `env` |
| `src/lib/auth.functions.ts`     | `getSession` server fn and `authMiddleware`                            |
| `src/lib/auth-client.ts`        | Browser client (`authClient.signIn.social`, `authClient.signOut`)      |
| `src/routes/api/auth/$.ts`      | Mounts Better Auth's endpoints at `/api/auth/*`                        |
| `src/routes/_authenticated.tsx` | Route guard; anything under `_authenticated/` requires a session       |
| `src/lib/account.functions.ts`  | Example protected server function                                      |
| `src/db/schema.ts`              | Auth tables (regenerate with `bun run auth:generate`)                  |

Route guards only protect pages. Every server function that touches user data must use
`authMiddleware` and scope queries by `context.user.id`:

```ts
export const listThings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return getDb().select().from(things).where(eq(things.userId, context.user.id));
  });
```

Workers cannot reuse sockets across requests, so never create the database client or auth
instance at module scope; always go through `getDb()` / `getAuth()`.

## Database scripts

- `bun run auth:generate` — regenerate `src/db/schema.ts` after changing Better Auth config/plugins
- `bun run db:generate` — create a SQL migration from schema changes
- `bun run db:migrate` — apply migrations
- `bun run db:studio` — browse the database

## Deploying to Cloudflare

> **Before the first production deploy, read [docs/known-concerns.md](docs/known-concerns.md).**
> Hyperdrive's default query cache causes stale reads after writes.

1. Provision Postgres (Neon, Supabase, RDS, …) and run `DATABASE_URL=<prod url> bun run db:migrate`.
2. `bunx wrangler hyperdrive create rolemark-db --connection-string="<prod url>"` and put the id in
   `wrangler.jsonc`.
3. Set `vars.BETTER_AUTH_URL` in `wrangler.jsonc` to the production origin.
4. `bunx wrangler secret put BETTER_AUTH_SECRET` (and `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
5. Add `https://<your-domain>/api/auth/callback/google` to the Google OAuth client.
6. `bun run deploy`

Run `bun run cf-typegen` after changing bindings in `wrangler.jsonc` or keys in `.env`.

## Deploys and version drift

- **CI** (`.github/workflows/ci.yml`) checks every pull request. Its builds
  are never deployed.
- **CD** (`.github/workflows/cd.yml`) runs only on pushes to `main`: it
  checks, builds once, and deploys that artifact via `scripts/deploy.sh`
  (currently a stub). Set the `PRODUCTION_URL` repository variable to have CD
  confirm the live build after deploying.

Every deployed build carries an identity (`APP_BUILD_ID` = commit SHA,
`APP_BUILD_SEQ` = CD run number) that the client compares against
`GET /api/version`. When the server is serving a newer build, open tabs show a
reload banner and the next in-app navigation does a full page load.

- Deploy the `dist` artifact CD builds; don't rebuild per environment.
- Roll back by reverting the commit on `main`, not by redeploying an old
  artifact. An old artifact has a lower run number, so open tabs won't be told
  to reload.
- Don't rename `cd.yml`: its run number would restart at 1.
