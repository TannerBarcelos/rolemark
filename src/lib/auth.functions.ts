import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, setResponseStatus } from "@tanstack/react-start/server";

import { getAuth } from "#/lib/auth.server";

/** Public: returns the current session or null. Used by the root route to populate router context. */
export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  return getAuth().api.getSession({ headers: getRequestHeaders() });
});

/**
 * Attach to every server function that reads or writes user data.
 * Route guards only protect page UI; server functions are callable directly over HTTP.
 * Handlers receive `context.session` and `context.user`; always scope queries by `context.user.id`.
 */
export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const session = await getAuth().api.getSession({ headers: getRequestHeaders() });
  if (!session) {
    setResponseStatus(401);
    throw new Error("Unauthorized");
  }
  return next({ context: { session: session.session, user: session.user } });
});
