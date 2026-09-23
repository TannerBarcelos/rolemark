import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";

import { type Auth, createAuth } from "#/auth/auth";
import { getDbFor } from "#/db/db.server";

// Same per-request keying as getDb(); the Better Auth instance reuses that request's client.
const instances = new WeakMap<Request, Auth>();

/** The Better Auth instance for the current request. Server-only. */
export function getAuth(): Auth {
  return getAuthFor(getRequest());
}

/**
 * The Better Auth instance for `request`. For code that runs before Start's request context
 * exists, such as the Worker entry (src/server.ts). Everywhere else, use getAuth().
 */
export function getAuthFor(request: Request): Auth {
  let auth = instances.get(request);
  if (!auth) {
    auth = createAuth(getDbFor(request), env);
    instances.set(request, auth);
  }
  return auth;
}
