import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";

import { type Auth, createAuth } from "#/auth/auth";
import { getDb } from "#/db/db.server";

// Same per-request keying as getDb(); the Better Auth instance reuses that request's client.
const instances = new WeakMap<Request, Auth>();

/** The Better Auth instance for the current request. Server-only. */
export function getAuth(): Auth {
  const request = getRequest();
  let auth = instances.get(request);
  if (!auth) {
    auth = createAuth(getDb(), env);
    instances.set(request, auth);
  }
  return auth;
}
