import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";

import { type Db, createDb } from "#/db/client.server";

// Keyed by the incoming Request so beforeLoad, middleware, and the handler share one
// client per request without leaking I/O objects across requests (which Workers forbids).
const clients = new WeakMap<Request, Db>();

/** The database client for the current request. Server-only. */
export function getDb(): Db {
  const request = getRequest();
  let db = clients.get(request);
  if (!db) {
    db = createDb(env.HYPERDRIVE.connectionString);
    clients.set(request, db);
  }
  return db;
}
