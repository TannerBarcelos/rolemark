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

## Auth

Layout, rules, and how to protect server functions: [docs/auth.md](docs/auth.md). In short, route
guards only protect pages, so every server function that touches user data must use
`authMiddleware` and scope queries by `context.user.id`.

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

Feature branches go into `develop` (deploys to staging), and `develop` or `hotfix/*` goes into
`main` (deploys to production). Full flow, hotfixes, CI/CD and rollback:
[docs/releases.md](docs/releases.md).

## Docs

| Doc                                                | Covers                                          |
| -------------------------------------------------- | ----------------------------------------------- |
| [docs/architecture.md](docs/architecture.md)       | Source layout, layer rules, client/server split |
| [docs/recipes.md](docs/recipes.md)                 | How to add functions, routes, tables, and more  |
| [docs/auth.md](docs/auth.md)                       | Auth files and rules                            |
| [docs/planetscale.md](docs/planetscale.md)         | Database topology, setup, schema changes        |
| [docs/releases.md](docs/releases.md)               | Branches, CI/CD, releases, version drift        |
| [docs/known-concerns.md](docs/known-concerns.md)   | Deferred risks                                  |
| [docs/tanstack-skills.md](docs/tanstack-skills.md) | TanStack API guidance for agents                |
