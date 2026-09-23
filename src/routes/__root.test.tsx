import { describe, expect, it, vi } from "vitest";

import { getSession } from "#/functions/auth.functions";
import { Route } from "#/routes/__root";

// The real server function needs the Start Vite plugin's RPC transform.
vi.mock("#/functions/auth.functions", () => ({ getSession: vi.fn() }));

describe("root route", () => {
  it("loads the session into router context", async () => {
    const session = { user: { id: "u1" }, session: { id: "s1" } };
    vi.mocked(getSession).mockResolvedValue(session as Awaited<ReturnType<typeof getSession>>);

    const beforeLoad = Route.options.beforeLoad as () => Promise<{ session: unknown }>;
    await expect(beforeLoad()).resolves.toEqual({ session });
  });

  it("passes a signed-out session through as null", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const beforeLoad = Route.options.beforeLoad as () => Promise<{ session: unknown }>;
    await expect(beforeLoad()).resolves.toEqual({ session: null });
  });

  it("sets the document title and links the stylesheet", () => {
    const head = (Route.options.head as () => { meta: object[]; links: { rel: string }[] })();
    expect(head.meta).toContainEqual({ title: "RoleMark" });
    expect(head.links).toContainEqual(expect.objectContaining({ rel: "stylesheet" }));
  });
});
