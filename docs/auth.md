# Auth

Better Auth with Google sign-in, sessions stored in Postgres, and a signed cookie cache.

## Files

| Path                                 | Purpose                                                               |
| ------------------------------------ | --------------------------------------------------------------------- |
| `src/auth/auth.ts`                   | `createAuth(db, env)`: Better Auth config (Google, account linking)   |
| `src/auth/auth.server.ts`            | `getAuth()`: per-request Better Auth instance built from Worker `env` |
| `src/auth/agent-access.server.ts`    | `authorizeAgentRequest`: the access check for every agent URL         |
| `src/auth/auth-client.ts`            | Browser client (`authClient.signIn.social`, `authClient.signOut`)     |
| `src/auth/auth.cli.ts`               | Config for `bun run auth:generate` only; never imported by the app    |
| `src/middleware/auth.middleware.ts`  | `authMiddleware` for protected server functions                       |
| `src/functions/auth.functions.ts`    | `getSession` server fn (public; returns the session or `null`)        |
| `src/functions/account.functions.ts` | Example protected server function                                     |
| `src/routes/__root.tsx`              | `beforeLoad` puts `session` into router context                       |
| `src/routes/_authenticated.tsx`      | Route guard: everything under `_authenticated/` requires a session    |
| `src/routes/api/auth/$.ts`           | Mounts Better Auth's endpoints at `/api/auth/*`                       |
| `src/routes/login.tsx`               | Sign-in page; `redirect` search param is sanitized by `lib/redirect`  |
| `src/db/schema.ts`                   | Auth tables (regenerate with `bun run auth:generate`)                 |

## Rules

- **Route guards protect pages, not data.** Server functions are callable directly over HTTP, so
  every server function that reads or writes user data needs `authMiddleware`:

  ```ts
  export const listThings = createServerFn({ method: "GET" })
    .middleware([authMiddleware])
    .handler(async ({ context }) => {
      return getDb().select().from(things).where(eq(things.userId, context.user.id));
    });
  ```

- **Authentication is not authorization.** `authMiddleware` proves who is calling, not whether
  they may touch a specific record. Scope every query by `context.user.id`, and check ownership
  for any function that takes a resource ID. The authorization design is still open: see
  [known-concerns.md](known-concerns.md#authorization-authz).
- **Agents are protected separately.** `/agents/*` URLs reach Durable Objects without server
  functions or `authMiddleware`. `src/server.ts` runs `authorizeAgentRequest` on each one: signed
  in, and the instance name must be the user's id or `<userId>:<key>`. Details:
  [integrations.md](integrations.md#agents).
- **Redirects:** pass user-supplied redirect targets through `sanitizeRedirect` (`#/lib/redirect`)
  to prevent open redirects.
- **Session cookie cache:** `cookieCache.maxAge` is 5 minutes, so a revoked session stays valid on
  other devices for up to 5 minutes. This is deliberate; don't lower it without a reason.
- **Account linking:** only providers that verify email ownership may go in
  `accountLinking.trustedProviders`.
- `tanstackStartCookies()` must stay the **last** plugin in `createAuth`.

## Changing Better Auth config or plugins

1. Edit `src/auth/auth.ts`.
2. If the change adds tables or columns: `bun run auth:generate`, then `bun run db:generate`, and
   commit both `src/db/schema.ts` and `drizzle/`.
3. New secrets or vars: add them to `AuthEnv`, `.env.example` and `wrangler.jsonc` (vars) or
   `wrangler secret put` (secrets), then `bun run cf-typegen`.
