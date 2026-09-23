import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";

import { type Db, createDb } from "#/db/client";
import { type Auth, createAuth } from "#/lib/auth";

interface RequestScope {
  db: Db;
  auth: Auth;
}

// Keyed by the incoming Request so beforeLoad, middleware, and the handler share one
// client per request without leaking I/O objects across requests (which Workers forbids).
const scopes = new WeakMap<Request, RequestScope>();

function getScope(): RequestScope {
  const request = getRequest();
  let scope = scopes.get(request);
  if (!scope) {
    const db = createDb(env.HYPERDRIVE.connectionString);
    scope = { db, auth: createAuth(db, env) };
    scopes.set(request, scope);
  }
  return scope;
}

export const getDb = () => getScope().db;
export const getAuth = () => getScope().auth;
