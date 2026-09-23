import { getAuthFor } from "#/auth/auth.server";

/** The agent and instance a request targets: /agents/<agent>/<name>. */
export type AgentRoute = { className: string; name: string };

type SessionLookup = (request: Request) => Promise<{ user: { id: string } } | null>;

function sessionFor(request: Request) {
  return getAuthFor(request).api.getSession({ headers: request.headers });
}

/**
 * Guard for every agent request (routeAgentRequest's onBeforeConnect and onBeforeRequest).
 * Agent URLs skip server functions and `authMiddleware`, so this is their only access check.
 * The caller must be signed in, and the instance name must be their user id or start with
 * `<userId>:` (for several instances per user, such as one per chat). Returns a response to reject
 * the request, or nothing to let it through.
 */
export async function authorizeAgentRequest(
  request: Request,
  route: AgentRoute,
  getSession: SessionLookup = sessionFor,
): Promise<Response | undefined> {
  const session = await getSession(request);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const owner = session.user.id;
  if (route.name !== owner && !route.name.startsWith(`${owner}:`)) {
    return new Response("Forbidden", { status: 403 });
  }
  return undefined;
}
