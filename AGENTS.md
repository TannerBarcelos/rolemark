# AGENTS.md

RoleMark: TanStack Start (React 19) on Cloudflare Workers, Better Auth (Google), Drizzle ORM,
Postgres via Hyperdrive (Docker locally, PlanetScale in staging/production). Package manager: `bun`.

This file is a router. Read the doc for your task from the table below before editing; don't
load docs you don't need.

## Routing

| When the task involves…                                                       | Read                                               |
| ----------------------------------------------------------------------------- | -------------------------------------------------- |
| Where a file goes, imports, layers, client vs server code                     | [docs/architecture.md](docs/architecture.md)       |
| Adding a server function, route, middleware, hook, component, or table        | [docs/recipes.md](docs/recipes.md)                 |
| Sessions, sign-in, route guards, `authMiddleware`, authorization              | [docs/auth.md](docs/auth.md)                       |
| `src/db/schema.ts`, migrations, `drizzle/`, PlanetScale, Hyperdrive           | [docs/planetscale.md](docs/planetscale.md)         |
| Branches, PRs, CI/CD, deploys, releases, hotfixes, build version / reload     | [docs/releases.md](docs/releases.md)               |
| Deferred risks (stale reads, authz) to check before shipping data features    | [docs/known-concerns.md](docs/known-concerns.md)   |
| Any TanStack Router/Start API (routes, loaders, server fns, middleware, SSR…) | [docs/tanstack-skills.md](docs/tanstack-skills.md) |
| Writing or reviewing any code: library defaults, TypeScript, React, errors    | [docs/conventions.md](docs/conventions.md)         |
| Styling, components, design tokens, Tailwind, React Aria, accessibility       | [docs/ui.md](docs/ui.md)                           |
| Writing any code (TDD is required), tests, coverage gate, Vitest projects     | [docs/testing.md](docs/testing.md)                 |
| Infra choices, external providers/SDKs, bindings, AI/LLM features, Sentry     | [docs/integrations.md](docs/integrations.md)       |

## Defaults

- **TanStack first**: Router/Start, Query, Form, Table, Virtual, Pacer, Store before anything else.
- **UI**: Tailwind themed through design tokens in `src/styles.css`; React Aria Components for every
  interactive widget, styled with Tailwind. No other component or CSS library.
- **Infra**: Cloudflare primitives first (R2, KV, Queues, Workflows, Durable Objects, AI Gateway,
  Workers AI, Vectorize). Third parties only for gaps (Sentry for observability).
- **AI**: LangChain JS / LangGraph, provider-agnostic (Workers AI is one provider), through AI
  Gateway.
- **Swappable providers**: app code depends on interfaces we own; vendor SDKs live only in
  adapters. Keep everything else concrete and simple.

## Commands

| Command                               | Use                                                                  |
| ------------------------------------- | -------------------------------------------------------------------- |
| `bun run dev`                         | Run locally in workerd on :3000 (needs `docker compose up -d`)       |
| `bun run build`                       | Production build; also generates `src/routeTree.gen.ts`              |
| `bun run generate-routes`             | Generate `src/routeTree.gen.ts` without building                     |
| `bun run typecheck`                   | `tsc --noEmit` (fails in a fresh clone until routes are generated)   |
| `bun run test` / `bun run test:watch` | Vitest: unit, DOM, and Workers-runtime projects                      |
| `bun run test:coverage`               | Tests with coverage (what CI runs)                                   |
| `bun run coverage:diff`               | Fails if changed code is < 90% covered (run after `test:coverage`)   |
| `bun run lint` / `bun run lint:fix`   | oxlint, including layer-boundary rules                               |
| `bun run fmt` / `bun run fmt:check`   | oxfmt                                                                |
| `bun run db:generate`                 | SQL migration from `src/db/schema.ts` changes                        |
| `bun run auth:generate`               | Regenerate auth tables in `src/db/schema.ts` from Better Auth config |
| `bun run cf-typegen`                  | Regenerate Worker types after `wrangler.jsonc` or `.env` key changes |

**Done means CI passes.** Before committing, run what CI runs (`.github/actions/check`):
`bun run lint && bun run fmt:check && bun run test:coverage && bun run coverage:diff`
`&& bun run db:generate` (must leave `drizzle/` unchanged) `&& bun run build && bun run typecheck`.

## Hard rules

1. Imports point **down** the layer stack; lint enforces it. Details: docs/architecture.md.
2. Anything that must never reach the browser is named `*.server.ts`.
3. Use `#/` for imports across folders. `../` imports are a lint error.
4. Every server function touching user data uses `authMiddleware` and scopes queries by
   `context.user.id`. Route guards do not protect server functions.
5. Never create a DB client or auth instance at module scope. Use `getDb()` / `getAuth()`.
6. Schema changes ship with a migration from `bun run db:generate`, and must be backward compatible
   with the previous release (expand, then contract). Never edit an applied migration.
7. Never hand-edit generated files: `src/routeTree.gen.ts`, `worker-configuration.d.ts`, the auth
   tables in `src/db/schema.ts`.
8. PRs target `develop`. Only `develop` and `hotfix/*` may target `main`. Never rename `cd.yml`.
9. Never commit secrets. `.env` is local only; deployed secrets go through `wrangler secret put`.
10. Work test-first (red, green, refactor), and cover at least 90% of changed lines and branches.
    CI enforces it with `bun run coverage:diff`. Details: docs/testing.md.
