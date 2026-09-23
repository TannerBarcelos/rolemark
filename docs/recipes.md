# Recipes

Step-by-step recipes for common changes. Each one follows the rules in
[architecture.md](architecture.md). Before writing TanStack APIs, load the matching skill from
[tanstack-skills.md](tanstack-skills.md).

## Server function

1. Add it to `src/functions/<domain>.functions.ts` (create the file if the domain is new).
2. Protect it unless it's deliberately public, and scope queries by the caller:

   ```ts
   import { createServerFn } from "@tanstack/react-start";
   import { eq } from "drizzle-orm";

   import { getDb } from "#/db/db.server";
   import { things } from "#/db/schema";
   import { authMiddleware } from "#/middleware/auth.middleware";

   export const listThings = createServerFn({ method: "GET" })
     .middleware([authMiddleware])
     .handler(async ({ context }) => {
       return getDb().select().from(things).where(eq(things.userId, context.user.id));
     });
   ```

3. Use `method: "POST"` for anything that writes, and validate input with `.validator(...)` (`.inputValidator` is deprecated).
4. Call it from a route `loader`/`beforeLoad` or a hook. Never import `*.server.ts` from those
   files.

## Page route

- A public page goes in `src/routes/<path>.tsx`. A page that needs sign-in goes in
  `src/routes/_authenticated/<path>.tsx`, which gives you `context.session` non-null.
- Routes stay thin: fetch through server functions in `loader`, render components.
- `src/routeTree.gen.ts` regenerates on `bun run dev`/`build`/`generate-routes`. Never edit it.

## API route (raw HTTP)

Prefer a server function. Use `src/routes/api/<path>.ts` with `server.handlers` only when a
non-app caller needs a stable URL, as with `api/version.ts` and `api/auth/$.ts`. Handlers get no
auth by default; check the session yourself with `getAuth().api.getSession(...)`.

## Middleware

1. Create `src/middleware/<name>.middleware.ts`.
2. Start the doc comment by stating its kind (`type: "function"` or `type: "request"`); see
   [architecture.md](architecture.md#middleware-kinds).
3. Function middleware: attach it with `.middleware([...])` on each server function.
   Request middleware: register it in `requestMiddleware` in `src/start.ts`, creating that file
   if needed.

## Hook or component

- Hooks go in `src/hooks/use-<name>.ts`, components in `src/components/<Name>.tsx`.
- Client-safe only: no `db/`, `middleware/`, or `auth/` imports except `#/auth/auth-client`.
  Server data comes from calling server functions.
- Shared helpers with no dependencies (usable on client and server) go in `src/lib/`.
- UI primitives go in `src/components/ui/`, following [ui.md](ui.md).
- Add a test next to the file ([testing.md](testing.md)).

## Table or column

1. Edit `src/db/schema.ts`. For auth tables, change `src/auth/auth.ts` and run
   `bun run auth:generate` instead.
2. `bun run db:generate` and commit the new `drizzle/` files.
3. Keep it backward compatible with the running release: add columns as nullable or with a default,
   and drop or rename only in a later release. See
   [planetscale.md](planetscale.md#changing-the-schema).
4. Any user-owned table needs a `userId` column, and every query on it is scoped by
   `context.user.id`.

## Worker binding, var or secret

1. Edit `wrangler.jsonc` for both the top level (production) and `env.staging`.
2. Add local values to `.env` and document them in `.env.example`.
3. `bun run cf-typegen`, and commit `worker-configuration.d.ts`.

## AI call

1. Test first: pass a fake `AI` binding to `getModel({ AI, AI_MODEL, AI_GATEWAY_ID })` and assert
   on what your code does with the canned response (`src/services/ai/model.worker.test.ts`).
2. Put the call in `src/services/ai/<task>.server.ts`, using `getModel()` and a prompt file from
   `src/services/ai/prompts/`. Validate structured output with a Zod schema.
3. Expose it through a server function with `authMiddleware`, like any other user-data access.

## AI agent

1. Test first in `src/agents/<name>-agent.worker.test.ts` (the `workers` project runs real Durable
   Objects): get an instance with `getAgentByName(env.<Binding>, "<userId>")` and call its methods.
2. Create `src/agents/<name>-agent.ts` exporting a class that extends `Agent` (or `AIChatAgent`
   for chat). Use `getModel()` for models and scope every DB query by the owning user id.
3. Export the class from `src/server.ts`: `export { ChatAgent } from "#/agents/chat-agent";`.
4. In `wrangler.jsonc`, add the Durable Object binding at the top level **and** in `env.staging`
   (bindings aren't inherited), and one migration at the top level (migrations are inherited):

   ```jsonc
   "durable_objects": { "bindings": [{ "name": "ChatAgent", "class_name": "ChatAgent" }] },
   "migrations": [{ "tag": "v1", "new_sqlite_classes": ["ChatAgent"] }],
   ```

   Migrations are append-only once deployed: never edit or remove one. Renaming or deleting an
   agent class is a new migration (`renamed_classes` / `deleted_classes`).

5. `bun run cf-typegen`, and commit `worker-configuration.d.ts`.
6. Clients connect to `/agents/<kebab-name>/<instance>` with `useAgent` / `useAgentChat`. The
   instance name must be the user's id or `<userId>:<key>`, or `authorizeAgentRequest` rejects it
   ([integrations.md](integrations.md#agents)).
