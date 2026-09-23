# Architecture

## Layers

`src/` is organized by layer. A file may import from its own layer or any layer **below** it,
never above.

| Layer (top → bottom) | Holds                                                      | Runs on          |
| -------------------- | ---------------------------------------------------------- | ---------------- |
| `routes/`            | File-based routes and API routes; compose the layers below | both             |
| `components/`        | React components                                           | client-safe      |
| `hooks/`             | React hooks                                                | client-safe      |
| `functions/`         | `createServerFn` RPCs (`*.functions.ts`)                   | server (RPC)     |
| `middleware/`        | `createMiddleware` (`*.middleware.ts`)                     | server           |
| `auth/`              | Better Auth config, `getAuth()`, browser client, CLI entry | mixed, see below |
| `db/`                | Drizzle schema, `createDb`, `getDb()`                      | server           |
| `lib/`               | Dependency-free helpers; imports only `lib/`               | both             |

`components/` and `hooks/` sit side by side and may import each other.

Other files: `src/router.tsx` (router factory; creates the per-request `QueryClient`),
`src/styles.css` (Tailwind and design tokens), `src/routeTree.gen.ts` (generated, gitignored),
`src/test/` (Vitest setup only; app code never imports it). Tests sit next to the file they test
([testing.md](testing.md)). `components/ui/` holds UI primitives ([ui.md](ui.md)).

## Enforcement

| Guard                                                                  | Catches                                                                    | Runs in             |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------- |
| oxlint `no-restricted-imports` (`.oxlintrc.json` overrides per folder) | Upward imports, server modules in `components/`/`hooks/`, any `../` import | `bun run lint`, CI  |
| TanStack Start import protection                                       | Any `*.server.*` file reaching the client bundle                           | `bun run build`, CI |

The lint patterns only match `#/…` paths, which is why `../` is banned outright. Use `./` only for
siblings in the same folder.

When you add a new top-level folder under `src/`, add a matching override to `.oxlintrc.json`
and a row to the table above.

## Client/server boundary

- Client code reaches the server **only** by calling a server function from `functions/`.
- Name every server-only module `*.server.ts`: `db/client.server.ts`, `db/db.server.ts`,
  `auth/auth.server.ts`. The build fails if client code imports one.
- In `auth/`: `auth-client.ts` is the browser client and the only file there that client code may
  import. `auth.ts` is a pure config factory shared by the server and the CLI. `auth.cli.ts` is used
  only by `bun run auth:generate`.
- `db/schema.ts` isn't `.server`-named because it holds only table definitions. Lint still keeps
  it out of client code. If it ever gains server logic, rename it.
- Env vars: Worker bindings and secrets come from `env` (`cloudflare:workers`) in `*.server.ts`
  files. Only `VITE_`-prefixed vars reach the client.

## Per-request scope (Cloudflare Workers)

Workers forbid sharing I/O objects (sockets) across requests, so:

- `getDb()` (`db/db.server.ts`) and `getAuth()` (`auth/auth.server.ts`) cache one instance per
  incoming `Request` in a `WeakMap`. `beforeLoad`, middleware and the handler share it.
  `getAuth()` builds on `getDb()`, so auth and app queries share one client.
- Never create a DB client or auth instance at module scope.
- Hyperdrive pools the real Postgres connections, so a client per request is cheap.

## Middleware kinds

| Kind                                     | Runs                                                          | Register                              |
| ---------------------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| `createMiddleware({ type: "function" })` | Only on server functions that list it in `.middleware([...])` | Per server function                   |
| `createMiddleware({ type: "request" })`  | On every server request (pages, API routes, server functions) | `requestMiddleware` in `src/start.ts` |

State the kind in each middleware file's doc comment. The folder name doesn't show it, and it
decides what the middleware protects.

## Evolving the layout

Code is currently sliced by layer. Once a feature spans three or more layers and there are
several such features, add `src/features/<name>/` holding that feature's functions, hooks and
components, and keep the same downward-import rules inside it. Ask before restructuring.
