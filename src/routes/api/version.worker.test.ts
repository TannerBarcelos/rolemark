import { describe, expect, it } from "vitest";

import { BUILD } from "#/lib/version";
import { Route } from "#/routes/api/version";

// Runs inside workerd, so it exercises the real Workers Response and headers APIs.
describe("GET /api/version", () => {
  it("returns the build and is never cached", async () => {
    const handlers = Route.options.server?.handlers;
    if (typeof handlers !== "object" || !handlers?.GET) throw new Error("GET handler missing");

    // The handler ignores its context, so an empty one is enough here.
    const response = await (handlers.GET as () => Response | Promise<Response>)();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(await response.json()).toEqual(BUILD);
  });
});
