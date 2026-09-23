# RoleMark

A TanStack Start app on Cloudflare Workers with self-hosted authentication via
[Better Auth](https://www.better-auth.com) (Google sign-in), Drizzle ORM, and Postgres through
Cloudflare Hyperdrive: `docker compose` locally, [PlanetScale Postgres](docs/planetscale.md) for
staging and production.

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

| Path                                 | Purpose                                                                |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `src/auth/auth.ts`                   | `createAuth(db, env)`: Better Auth config (Google, account linking)    |
| `src/auth/auth.server.ts`            | `getAuth()` / `getDb()`: per-request instances built from Worker `env` |
| `src/middleware/auth.middleware.ts`  | `authMiddleware` for protected server functions                        |
| `src/auth/auth-client.ts`            | Browser client (`authClient.signIn.social`, `authClient.signOut`)      |
| `src/functions/auth.functions.ts`    | `getSession` server fn                                                 |
| `src/functions/account.functions.ts` | Example protected server function                                      |
| `src/routes/api/auth/$.ts`           | Mounts Better Auth's endpoints at `/api/auth/*`                        |
| `src/routes/_authenticated.tsx`      | Route guard; anything under `_authenticated/` requires a session       |
| `src/db/schema.ts`                   | Auth tables (regenerate with `bun run auth:generate`)                  |

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
- `bun run db:generate` — create a SQL migration from schema changes (commit `drizzle/`; CI fails
  if the schema and migrations disagree)
- `bun run db:migrate` — apply migrations to `DATABASE_URL` (local; CD migrates staging/production)
- `bun run db:studio` — browse the database

## Deploying to Cloudflare

> **Before the first production deploy, read [docs/known-concerns.md](docs/known-concerns.md).**
> Hyperdrive's default query cache causes stale reads after writes.

1. Set up the PlanetScale `main` branch, its `app`/`migrator` roles, the initial migration, the
   `rolemark-db` Hyperdrive config (caching disabled), and the `production` environment's
   `DATABASE_URL` secret: [docs/planetscale.md](docs/planetscale.md#setup-once-per-environment).
2. Put the Hyperdrive id in `wrangler.jsonc`.
3. Set `vars.BETTER_AUTH_URL` in `wrangler.jsonc` to the production origin.
4. `bunx wrangler secret put BETTER_AUTH_SECRET` (and `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
5. Add `https://<your-domain>/api/auth/callback/google` to the Google OAuth client.
6. `bun run deploy`

**Staging** (`env.staging` in `wrangler.jsonc`, Worker `rolemark-staging`) is deployed from
`develop` and needs its own copy of everything above. Never point it at the production database.

1. Same PlanetScale setup on the **`staging` branch**, with its own roles, the
   `rolemark-db-staging` Hyperdrive config, and the `staging` environment's `DATABASE_URL` secret.
2. Put the Hyperdrive id in `env.staging.hyperdrive`.
3. Set `env.staging.vars.BETTER_AUTH_URL` to the staging origin.
4. `bunx wrangler secret put BETTER_AUTH_SECRET --env staging` (and the Google secrets). Use a
   different `BETTER_AUTH_SECRET` from production.
5. Add `https://<staging-domain>/api/auth/callback/google` to the Google OAuth client, or use a
   separate staging client.
6. `CLOUDFLARE_ENV=staging bun run deploy`

CD builds with `CLOUDFLARE_ENV=staging` on `develop` and without it on `main`, and
`scripts/deploy.sh` refuses to deploy a build to a different environment than it was built for.
Before deploying, CD applies `drizzle/` migrations to that environment's PlanetScale branch, so
migrations must be backward compatible with the previous release
([docs/planetscale.md](docs/planetscale.md#changing-the-schema)).

Run `bun run cf-typegen` after changing bindings in `wrangler.jsonc` or keys in `.env`.

## Branches, releases, and version drift

| Branch    | Role                                    | Receives PRs from                | Deploys to   |
| --------- | --------------------------------------- | -------------------------------- | ------------ |
| `develop` | Staging: stable, next release candidate | feature branches                 | `staging`    |
| `main`    | Production                              | `develop` (releases), `hotfix/*` | `production` |

1. Branch from `develop`, open a PR back into `develop`. CI must pass and the
   branch must be up to date.
2. Merging deploys to **staging**. Verify there.
3. To release, open a PR **`develop` → `main`** (merge commit). The
   `release-source` check rejects PRs into `main` from anything other than
   `develop` or `hotfix/*`.
4. Merging deploys to **production**.

**Hotfixes** skip staging when production can't wait for the next release:

1. Branch `hotfix/<name>` from `main` and open a PR into `main`.
2. Merging deploys to production.
3. Open a second PR from the same `hotfix/<name>` branch into `develop`. Without it, the next
   release from `develop` undoes the fix.

- **CI** (`.github/workflows/ci.yml`) checks every pull request. Its builds
  are never deployed.
- **CD** (`.github/workflows/cd.yml`) runs only on pushes to `develop` and
  `main`: it checks, builds once, and deploys that artifact via
  `scripts/deploy.sh` (currently a stub; see "Deploying to Cloudflare" for the
  manual steps). Set a `DEPLOY_URL` variable on each GitHub environment to have
  CD confirm the live build after deploying.

Every deployed build carries an identity (`APP_BUILD_ID` = commit SHA,
`APP_BUILD_SEQ` = CD run number) that the client compares against
`GET /api/version`. When the server is serving a newer build, open tabs show a
reload banner and the next in-app navigation does a full page load.

- Deploy the `dist` artifact CD builds; don't rebuild it by hand.
- Roll back by reverting on `develop` and releasing (or a `hotfix/*` revert when
  it's urgent), not by redeploying an old
  artifact. An old artifact has a lower run number, so open tabs won't be told
  to reload.
- Don't rename `cd.yml`: its run number would restart at 1.
