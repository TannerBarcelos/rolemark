import { describe, expect, it, vi } from "vitest";

import { getAuth, getAuthFor } from "#/auth/auth.server";

// Start's request context needs its Vite plugin; tests supply the current request directly.
const current = vi.hoisted(() => ({ request: new Request("https://rolemark.test/current") }));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => current.request }));

describe("getAuthFor", () => {
  it("reuses one auth instance per request", () => {
    const request = new Request("https://rolemark.test/");
    expect(getAuthFor(request)).toBe(getAuthFor(request));
  });

  it("never shares an auth instance across requests", () => {
    expect(getAuthFor(new Request("https://rolemark.test/a"))).not.toBe(
      getAuthFor(new Request("https://rolemark.test/b")),
    );
  });

  it("getAuth() uses the current request's instance", () => {
    expect(getAuth()).toBe(getAuthFor(current.request));
  });
});
