# PlanetScale Postgres

Staging and production run on [PlanetScale Postgres](https://planetscale.com/docs/postgres). Local
development keeps using `docker compose`. The app code is the same everywhere: Drizzle over
`postgres.js`, reached through the Worker's `HYPERDRIVE` binding.

```
Worker ──(HYPERDRIVE binding)──► Hyperdrive ──(TLS, port 5432, `app` role)──► PlanetScale branch
CD     ──(drizzle-kit migrate, `migrator` role, port 5432, sslmode=verify-full)──┘
```

## Topology

| Environment | Database                           | Worker connects via                     | Migrated by                           |
| ----------- | ---------------------------------- | --------------------------------------- | ------------------------------------- |
| local       | `docker compose` (Postgres 17)     | `localConnectionString` (no Hyperdrive) | `bun run db:migrate` with `.env`      |
| staging     | PlanetScale `rolemark` / `staging` | Hyperdrive `rolemark-db-staging`        | CD on `develop`, `staging` env secret |
| production  | PlanetScale `rolemark` / `main`    | Hyperdrive `rolemark-db`                | CD on `main`, `production` env secret |

One PlanetScale database with two branches keeps it in one place, and branches are fully
isolated: separate compute, data, and credentials (role usernames embed the branch ID, so a staging
credential cannot reach `main`). `main` is the production branch (with replicas); `staging` is a
development branch (single node, cheaper). Two separate databases work as well if you want separate
billing or access; nothing in the code depends on the choice.

Use **Postgres 17** for both branches. It matches `docker-compose.yml`, and it is the newest major
version Cloudflare documents as Hyperdrive-compatible.

## Roles

Create two roles on **each** branch. Never give the Worker the default (admin) role.

| Role       | `--inherited-roles`                  | Used by                               | Stored in                                |
| ---------- | ------------------------------------ | ------------------------------------- | ---------------------------------------- |
| `app`      | `pg_read_all_data,pg_write_all_data` | The Worker (Better Auth, app queries) | The Hyperdrive config only               |
| `migrator` | `postgres`                           | `drizzle-kit migrate` in CD           | GitHub environment secret `DATABASE_URL` |

`app` can read and write rows in every table, including tables `migrator` creates later, but cannot
`CREATE`, `ALTER`, or `DROP`. A compromised Worker or a bad query cannot change the schema.

## Setup (once per environment)

Shown for production; for staging use the `staging` branch, `rolemark-db-staging`, `--env staging`,
and the `staging` GitHub environment.

1. **Database.** In the PlanetScale dashboard create a Postgres database `rolemark` (Postgres 17, a
   region close to your users). For staging, add a branch `staging`.
2. **Roles.**

   ```bash
   pscale role create rolemark main app --inherited-roles pg_read_all_data,pg_write_all_data
   pscale role create rolemark main migrator --inherited-roles postgres
   ```

   Each prints a username (`<role>.<branch-id>`), password, and host once. Save them.

3. **Initial schema** (creates the Better Auth tables):

   ```bash
   DATABASE_URL='postgresql://migrator.<branch-id>:<password>@<host>:5432/postgres?sslmode=verify-full' \
     bun run db:migrate
   ```

4. **Hyperdrive** with the `app` role and caching disabled (see
   [known concerns](known-concerns.md#critical-hyperdrive-query-caching-serves-stale-reads)):

   ```bash
   bunx wrangler hyperdrive create rolemark-db --caching-disabled \
     --connection-string='postgresql://app.<branch-id>:<password>@<host>:5432/postgres'
   ```

   Put the returned id in `wrangler.jsonc` (`env.staging.hyperdrive` for staging). Leave `sslmode` out
   of this string: Hyperdrive configures TLS to the origin itself.

5. **CD migrations.** In GitHub → Settings → Environments → `production`, add the secret
   `DATABASE_URL` = the `migrator` URL from step 3.
6. **Auth secrets** are unchanged: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   via `wrangler secret put` (see the README).

### Why these connection settings

- **Port 5432 (direct), not 6432 (PgBouncer).** Hyperdrive is already a connection pooler. Putting it
  in front of PgBouncer adds a hop and brings PgBouncer's transaction-mode limits (no session state
  across transactions). Migrations also need a direct connection for DDL.
- **`sslmode=verify-full` for drizzle-kit.** PlanetScale requires TLS; `verify-full` also checks the
  certificate chain and that it was issued for `<host>`, so a spoofed server cannot collect the
  `migrator` password.
- **Hyperdrive TLS.** Hyperdrive always encrypts to the origin. Its default mode (`require`) does not
  verify the certificate. To harden it, upload the CA that issued PlanetScale's certificate
  (`wrangler cert upload certificate-authority`) and add
  `--sslmode verify-full --ca-certificate-id <id>`.
- **Optional:** `--origin-connection-limit <n>` keeps Hyperdrive under the branch's
  `max_connections`, leaving room for migrations and consoles on small clusters.

## Changing the schema

1. Edit `src/db/schema.ts` (after changing Better Auth plugins, run `bun run auth:generate` first).
2. `bun run db:generate` and commit the new file in `drizzle/`. CI fails if the schema and
   migrations disagree.
3. Merge into `develop`: CD migrates the `staging` branch, then deploys the staging Worker.
4. Release to `main`: CD migrates `main`, then deploys production.

Migrations run **before** the new Worker is live, so the running Worker briefly uses the new
schema. Every migration must work with the previous release's code (expand, then contract):

- Add columns as nullable or with a default; add tables freely.
- Drop or rename in a **later** release, once no deployed code reads the old shape. A rename is
  add → backfill → switch reads → drop.
- Never edit a migration that has run anywhere but your machine; add a new one.
- Never run `drizzle-kit push` against staging or production. `drizzle/` is the history.

PlanetScale Postgres has no deploy requests (those are Vitess-only), so the `drizzle/` history plus
CD is how schema changes get from `staging` to `main`.

## Failovers

During maintenance or a failover, PlanetScale drops open connections. Hyperdrive reconnects to the
origin, and the app creates a fresh client per request, so nothing stays broken. Queries in flight at
that moment fail. Keep transactions short (PlanetScale recommends under 3 seconds).
