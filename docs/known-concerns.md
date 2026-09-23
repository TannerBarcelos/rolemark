# Known concerns

Deliberately deferred issues. Resolve each one before the milestone listed with it.

## CRITICAL: Hyperdrive query caching serves stale reads

**Status:** Mitigated in setup, not yet verified. [docs/planetscale.md](planetscale.md) creates both
Hyperdrive configs with `--caching-disabled` (option 1 below). Close this once the "Done when" test
has passed against the real staging and production configs.

**Problem.** Hyperdrive caches the results of read queries (`SELECT`) by default: 60s `max-age`
plus a stale-while-revalidate window. Writes are never cached, but a read that runs right after a
write can return the cached result from _before_ the write. Local dev does not reproduce this,
because `localConnectionString` bypasses Hyperdrive entirely.

**Where it bites:**

- **Read-after-write in app data.** A user creates or edits a record, the loader re-runs, and the
  old list or value comes back. It looks like the save failed.
- **Auth.** Better Auth reads `session`/`user`/`account` through the same connection. After
  sign-out on one device, or after account linking, other reads can see the old rows until the
  cache expires. The accepted 5-minute `cookieCache` window already covers the session case, but
  `user` and `account` reads (e.g. `getLinkedProviders`) are affected too.

**Options (pick one when resolving):**

1. Disable caching on the config. Simplest and always correct, at the cost of losing edge read
   caching:
   `wrangler hyperdrive update <id> --caching-disabled`
2. Two Hyperdrive configs: a cached one for tolerant reads (public or aggregate data) and an
   uncached one for auth and read-after-write paths, exposed as two bindings with
   `getDb({ fresh: true })`.
3. Keep caching, tune `--max-age`/`--swr`, and push fresh data from mutations (return the updated
   row and update the UI from it instead of refetching).

**Recommendation:** start with option 1. Move to option 2 only when a measured read hot path needs
it.

**Done when:** the chosen option is applied to the production Hyperdrive config, and a test proves
that a write followed by a read returns the new value through Hyperdrive (not only against local
Postgres).

## Authorization (authz)

**Status:** Deferred. Must be designed before the first user-owned resource ships.

`authMiddleware` proves who is calling, not whether they may access a specific record. Every
server function that takes a resource ID must check ownership or permission, e.g. filter by
`context.user.id` or use a permission-checking middleware factory. Route guards (`_authenticated`)
do not protect server functions.
