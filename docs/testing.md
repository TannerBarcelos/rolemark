# Testing

Vitest, configured in `vitest.config.ts` (separate from `vite.config.ts`). CI runs `bun run test`
in `.github/actions/check`, so a failing test blocks merge and deploy.

| Command                     | Use                                    |
| --------------------------- | -------------------------------------- |
| `bun run test`              | Run every project once (what CI runs)  |
| `bun run test:watch`        | Watch mode                             |
| `bunx vitest run <path>`    | One file or folder                     |
| `bunx vitest --project dom` | One project (`unit`, `dom`, `workers`) |

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

Tests that need Postgres (Drizzle queries, Better Auth) aren't set up yet, because CI has no
database. Keep query logic thin and put decisions in plain functions you can unit test. Ask before
adding a database to CI.

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

Examples in the repo: `src/lib/*.test.ts`, `src/components/**/*.test.tsx`,
`src/routes/api/version.worker.test.ts`.
