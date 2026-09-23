# Conventions

How code in this repo is written. Layers and file placement: [architecture.md](architecture.md).
UI: [ui.md](ui.md). Providers and AI: [integrations.md](integrations.md). Tests:
[testing.md](testing.md).

## Library defaults

Everything in this table is installed. Prefer the TanStack package whenever one solves the problem. Load its skill first
([tanstack-skills.md](tanstack-skills.md)); where no skill is listed, read the package docs for the
installed version.

| Need                                     | Use                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| Routing, loaders, SSR, server functions  | TanStack Router / Start                                                |
| Client cache, mutations, invalidation    | TanStack Query (with the router's SSR integration)                     |
| Forms                                    | TanStack Form                                                          |
| Tables, data grids                       | TanStack Table                                                         |
| Long lists                               | TanStack Virtual                                                       |
| Debounce, throttle, rate-limit in the UI | TanStack Pacer                                                         |
| Shared client state outside the URL      | TanStack Store                                                         |
| Schemas and validation                   | Zod (server fn `.validator`, forms, `validateSearch`, LLM output)      |
| Database                                 | Drizzle                                                                |
| Styling / components                     | Tailwind + React Aria Components ([ui.md](ui.md))                      |
| Tests                                    | Vitest + Testing Library ([testing.md](testing.md))                    |
| AI                                       | Agents SDK + AI SDK on Workers AI ([integrations.md](integrations.md)) |

Where state lives, in order of preference: the URL (search params via `validateSearch`) → route
loader data → TanStack Query → local component state → TanStack Store. No React context for server
data.

## Dependencies

- Before adding a package, check the tables above and [integrations.md](integrations.md). If
  something listed covers the need, use it.
- A new package must run on workerd (`nodejs_compat`, no native modules), be maintained, and be
  worth its bundle size in client code. Say why in the PR.
- Install with `bun add`. Never mix package managers.

## Design for change

- Depend on interfaces we own at every external seam (providers, APIs, I/O). Details:
  [integrations.md](integrations.md#ports-and-adapters-for-every-provider).
- Inside the app, keep it concrete: plain functions, small modules, no abstraction without a second
  implementation or a provider seam behind it. Three similar lines beat a premature helper.
- Configuration (model ids, feature flags, limits, URLs) comes from `wrangler.jsonc` vars or
  secrets, not literals in code.
- One module, one job. A file over ~300 lines or a function over ~50 is a signal to split.
- Pure logic (parsing, calculations, mapping) lives in `lib/` or next to its caller as plain
  functions with no I/O, so it's easy to test and reuse.

## TypeScript

- `strict` is on. No `any`; use `unknown` and narrow. No `as` casts except at a validated boundary,
  and no non-null `!` without a comment saying why it's safe.
- Validate everything that crosses a trust boundary with Zod: server function input, search params,
  env-derived config, external API responses, LLM output. Infer types from the schema
  (`z.infer<typeof schema>`) instead of declaring them twice.
- Model variants as discriminated unions and handle them with exhaustive `switch` (a `never` check
  in `default`).
- Use `satisfies` to check object literals without widening. Prefer `type` imports
  (`verbatimModuleSyntax` is on).
- Export named functions and types; no default exports except where a framework requires one.

## React

- Fetch in route loaders or with TanStack Query, never in `useEffect`.
- Derive values during render instead of syncing them into state. `useEffect` is for real side
  effects (subscriptions, browser APIs), and each one says in a comment what it syncs with.
- Components take the data they render as props; hooks own data access and behavior. Keep
  components small enough to read in one screen.
- Every route that loads data has a `pendingComponent` and `errorComponent` (or inherits sensible
  ones), and every list has an empty state.
- Keys are stable ids, never array indexes for lists that can reorder.

## Errors and logging

- Expected failures (not found, forbidden, validation) are handled explicitly and shown to the user
  with a useful message. Unexpected ones throw and reach the route's `errorComponent` and Sentry.
- Never send stack traces, SQL, or vendor error bodies to the client.
- Don't swallow errors. A `catch` either handles the error, adds context and rethrows, or reports
  it.
- Log structured objects (`console.log({ event: "invite.sent", userId, … })`), never secrets or
  personal data beyond ids. Workers Logs indexes the fields.
- Fire-and-forget work after the response uses `waitUntil`, never an unawaited promise.

## Naming and comments

- Files: components `PascalCase.tsx`, everything else `kebab-case.ts` with the role suffix used in
  its folder (`.functions.ts`, `.middleware.ts`, `.server.ts`). Hooks start with `use-`.
- Names say what a thing is in domain terms (`listInvites`, not `getData`). Booleans read as
  questions (`isStale`, `hasAccess`).
- Comments explain why (constraints, trade-offs, non-obvious behavior), not what the code does.
  Exported functions get a one-line doc comment when their name doesn't say it all.

## Scope of a change

- Start from failing tests that capture the task's scope, and ship with >= 90% of the changed code
  covered ([testing.md](testing.md#test-driven-90-of-new-code)).
- Do what the task asks. Don't refactor, rename, or reformat unrelated code in the same PR; note it
  instead.
- Ask before adding a top-level `src/` folder, a new third-party service, or a new state or styling
  approach.
- Update the relevant doc in `docs/` in the same PR when a change makes it wrong.
