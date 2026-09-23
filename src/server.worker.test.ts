import { routeAgentRequest } from "agents";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeAgentRequest } from "#/auth/agent-access.server";
import server from "#/server";

// Start's real handler needs its Vite plugin; stand it in with a marker response.
const appFetch = vi.hoisted(() => vi.fn(async () => new Response("app")));
vi.mock("@tanstack/react-start/server-entry", () => ({
  default: { fetch: appFetch },
  createServerEntry: (entry: unknown) => entry,
}));
vi.mock("agents", () => ({ routeAgentRequest: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: vi.fn() }));

const routeAgent = vi.mocked(routeAgentRequest);

describe("worker entry", () => {
  beforeEach(() => {
    appFetch.mockClear();
    routeAgent.mockReset();
  });

  it("sends agent requests to the agent's Durable Object", async () => {
    routeAgent.mockResolvedValue(new Response("agent"));
    const request = new Request("https://rolemark.test/agents/chat-agent/u1");

    const response = await server.fetch(request);

    expect(await response.text()).toBe("agent");
    expect(routeAgent).toHaveBeenCalledWith(request, env, {
      onBeforeConnect: authorizeAgentRequest,
      onBeforeRequest: authorizeAgentRequest,
    });
    expect(appFetch).not.toHaveBeenCalled();
  });

  it("serves everything else from the app, passing its arguments through", async () => {
    routeAgent.mockResolvedValue(null);
    const request = new Request("https://rolemark.test/dashboard");
    const opts = { context: {} };

    const response = await server.fetch(request, opts as never);

    expect(await response.text()).toBe("app");
    expect(appFetch).toHaveBeenCalledWith(request, opts);
  });
});
