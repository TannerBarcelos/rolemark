import { QueryClient } from "@tanstack/react-query";
import { createRootRoute } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { getRouter } from "#/router";

// The generated tree imports every route and its server functions, which need the Start Vite
// plugin. getRouter's own wiring doesn't depend on which routes exist.
vi.mock("#/routeTree.gen", () => ({ routeTree: createRootRoute() }));

describe("getRouter", () => {
  it("puts a QueryClient in the router context", () => {
    expect(getRouter().options.context.queryClient).toBeInstanceOf(QueryClient);
  });

  it("creates a new QueryClient per router, so SSR requests never share a cache", () => {
    expect(getRouter().options.context.queryClient).not.toBe(
      getRouter().options.context.queryClient,
    );
  });

  it("leaves caching to Query and preloads on intent", () => {
    const { options } = getRouter();
    expect(options.defaultPreloadStaleTime).toBe(0);
    expect(options.defaultPreload).toBe("intent");
  });
});
