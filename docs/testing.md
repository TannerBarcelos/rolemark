# Testing

Vitest, configured in `vitest.config.ts` (separate from `vite.config.ts`). Every PR (`ci.yml`) and
every deploy (`cd.yml`) runs the suite with coverage through `.github/actions/check`. A failing
test blocks merge and deploy, and on PRs so does diff coverage under 90%.

| Command                     | Use                                                         |
| --------------------------- | ----------------------------------------------------------- |
| `bun run test`              | Run every project once                                      |
| `bun run test:watch`        | Watch mode, for the TDD loop                                |
| `bun run test:coverage`     | Run once with coverage; writes `coverage/lcov.info` (CI)    |
| `bun run coverage:diff`     | Gate: changed lines and branches vs `origin/develop` >= 90% |
| `bunx vitest run <path>`    | One file or folder                                          |
| `bunx vitest --project dom` | One project (`unit`, `dom`, `workers`)                      |

## Test-driven, 90% of new code

Write the test first. For every change:

1. **Red.** Turn the task's requirements into failing tests: the happy path, each edge case and
   error the scope names, and authorization for anything touching user data. Run them and watch
   them fail for the right reason (a missing function or wrong result, not a typo).
2. **Green.** Write the least code that passes.
3. **Refactor** with the tests green.
4. **Check coverage:** `bun run test:coverage && bun run coverage:diff`. Every uncovered line it
   lists is either behavior the tests missed (add a test) or code the task doesn't need (delete
   it).

The bar is **>= 90% of changed lines and >= 90% of branches on changed lines**, measured by
`scripts/diff-coverage.ts` against the PR's base branch. A changed file with none of its changed lines covered
fails on its own, so well-tested files can't hide a forgotten one. It measures only the diff, so untested
legacy code never blocks a change, and every change pays for its own code. Uncommitted and
untracked files count locally, so the gate works mid-TDD. Coverage is a floor, not the goal: a
test that runs a line without asserting what it does doesn't count in review.

- Don't add `istanbul ignore` comments to pass the gate. The only accepted use is code that
  genuinely can't run under test (a script's `import.meta.main` entry), with a reason in the
  comment.
- Don't raise coverage with tests that assert nothing, or by moving code into excluded files.
- Files only reached through the Start Vite plugin (the generated route tree, real server-function
  RPC) can't load in tests. Mock at that seam, as `src/router.test.ts` mocks `#/routeTree.gen` and
  `src/routes/__root.test.tsx` mocks the server function.

## Projects

The file name picks the environment. Put the test next to the file it tests.

| File name          | Project   | Runs in                                 | For                                                                 |
| ------------------ | --------- | --------------------------------------- | ------------------------------------------------------------------- |
| `*.test.ts`        | `unit`    | Node                                    | Pure logic: `lib/`, parsers, mappers, Zod schemas                   |
| `*.test.tsx`       | `dom`     | happy-dom + Testing Library             | Components and hooks                                                |
| `*.worker.test.ts` | `workers` | workerd, with `wrangler.jsonc` bindings | Server code that needs Workers APIs or bindings (R2, KV, Queues, …) |

The `workers` project uses `@cloudflare/vitest-pool-workers`. Its bundled workerd can trail
`compatibility_date` in `wrangler.jsonc`, so `vitest.config.ts` pins the test runtime's date; bump
or drop that override when the pool updates. The `vpw:warn` about the main entry point is expected:
Start's server entry is a virtual module, so whole-app `SELF.fetch` tests aren't available. Test
route handlers, server logic, and adapters directly instead.

Setup for the `dom` project (jest-dom matchers, cleanup) is in `src/test/setup-dom.ts`.

## What to test

| Change                               | Test                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------- |
| New or changed logic in `lib/`       | Unit test covering the edge cases, not just the happy path                  |
| New UI primitive in `components/ui/` | Behavior and keyboard access (`userEvent.tab`, `{Enter}`), variant classes  |
| New feature component or hook        | What the user sees and does; mock the hook or server function it depends on |
| Provider adapter (`services/*`)      | Maps vendor responses and errors to the port's types; vendor calls mocked   |
| Server function / API route handler  | Validation, authorization (another user's data is refused), response shape  |
| Bug fix                              | A test that fails before the fix                                            |

Tests that run real Postgres queries (Drizzle, Better Auth) aren't set up yet. Until they are, the
90% gate still applies to server functions: keep query code thin, put decisions in plain functions
you unit test, and mock `#/db/db.server` at the seam for the handler's own logic (auth scoping,
validation, response shape). Ask before adding a database to the test setup.

## How to write them

- Test behavior through the public surface: rendered output, roles, returned values. Not internal
  state, private helpers, or class names (except a primitive's variant contract).
- Query the DOM the way a user or screen reader would: `getByRole` with an accessible `name`
  first, then `getByLabelText`, then `getByText`. `getByTestId` is a last resort. If a role query
  can't find an element, fix the markup's accessibility before reaching for a test id.
- Use `userEvent`, not `fireEvent`, for interactions.
- Mock at our own seams (a hook, a server function, a port), not deep inside libraries. For
  provider code, test against the port with a fake adapter.
- No network in tests. No snapshot tests of whole components; assert the specific thing that
  matters.
- Each test sets up its own data. Tests must pass alone and in any order.
- Use `it.each` for tables of inputs rather than copy-pasted tests.

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "#/components/ui/Button";

describe("Button", () => {
  it("is operable from the keyboard", async () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Save</Button>);

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onPress).toHaveBeenCalledOnce();
  });
});
```

Examples in the repo: `src/lib/*.test.ts`, `src/router.test.ts`, `src/components/**/*.test.tsx`,
`src/routes/__root.test.tsx`, `src/routes/api/version.worker.test.ts`,
`scripts/diff-coverage.test.ts` (including a real temporary git repo).
