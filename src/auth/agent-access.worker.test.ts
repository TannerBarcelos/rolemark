import { describe, expect, it, vi } from "vitest";

import { authorizeAgentRequest } from "#/auth/agent-access.server";

// auth.server imports Start's request context, which needs its Vite plugin.
vi.mock("@tanstack/react-start/server", () => ({ getRequest: vi.fn() }));

const request = new Request("https://rolemark.test/agents/chat-agent/u1");
const route = (name: string) => ({ className: "ChatAgent", name });
const signedInAs = (id: string) => vi.fn(async () => ({ user: { id } }));
const signedOut = vi.fn(async () => null);

describe("authorizeAgentRequest", () => {
  it("rejects signed-out callers with 401", async () => {
    const response = await authorizeAgentRequest(request, route("u1"), signedOut);
    expect(response?.status).toBe(401);
  });

  it("lets a user reach the agent instance named after them", async () => {
    await expect(
      authorizeAgentRequest(request, route("u1"), signedInAs("u1")),
    ).resolves.toBeUndefined();
  });

  it("lets a user reach their own sub-instances (<userId>:<key>)", async () => {
    await expect(
      authorizeAgentRequest(request, route("u1:chat-42"), signedInAs("u1")),
    ).resolves.toBeUndefined();
  });

  it.each(["u2", "u2:chat-42", "u10", "u1x", "xu1", ""])(
    "rejects user u1 reaching instance %j with 403",
    async (name) => {
      const response = await authorizeAgentRequest(request, route(name), signedInAs("u1"));
      expect(response?.status).toBe(403);
    },
  );

  it("uses the Better Auth session by default, so a request with no cookie is 401", async () => {
    const response = await authorizeAgentRequest(request, route("u1"));
    expect(response?.status).toBe(401);
  });

  it("reads the session from the incoming request", async () => {
    const getSession = signedInAs("u1");
    await authorizeAgentRequest(request, route("u1"), getSession);
    expect(getSession).toHaveBeenCalledWith(request);
  });
});
