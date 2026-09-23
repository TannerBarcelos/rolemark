import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { getAuth } from "#/auth/auth.server";

/** Public: returns the current session or null. Used by the root route to populate router context. */
export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  return getAuth().api.getSession({ headers: getRequestHeaders() });
});
