import { describe, expect, it, vi } from "vitest";

import { getDb, getDbFor } from "#/db/db.server";

// Start's request context needs its Vite plugin; tests supply the current request directly.
const current = vi.hoisted(() => ({ request: new Request("https://rolemark.test/current") }));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => current.request }));

// Creating a client opens no connection, so this needs no database.
describe("getDbFor", () => {
  it("reuses one client per request", () => {
    const request = new Request("https://rolemark.test/");
    expect(getDbFor(request)).toBe(getDbFor(request));
  });

  it("never shares a client across requests", () => {
    expect(getDbFor(new Request("https://rolemark.test/a"))).not.toBe(
      getDbFor(new Request("https://rolemark.test/b")),
    );
  });

  it("getDb() uses the current request's instance", () => {
    expect(getDb()).toBe(getDbFor(current.request));
  });
});
