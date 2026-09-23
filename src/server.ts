import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { routeAgentRequest } from "agents";
import { env } from "cloudflare:workers";

import { authorizeAgentRequest } from "#/auth/agent-access.server";

// Worker entry (wrangler.jsonc `main`). Durable Object classes must be exported from here, so every
// agent in src/agents/ gets a line like: export { ChatAgent } from "#/agents/chat-agent";
// docs/recipes.md#ai-agent.

export default createServerEntry({
  async fetch(request, ...rest) {
    // /agents/<agent-name>/<instance> goes to that agent's Durable Object, if the caller owns the
    // instance; everything else is the app.
    const agentResponse = await routeAgentRequest(request, env, {
      onBeforeConnect: authorizeAgentRequest,
      onBeforeRequest: authorizeAgentRequest,
    });
    return agentResponse ?? handler.fetch(request, ...rest);
  },
});
