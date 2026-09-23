import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Workers cannot share sockets between requests, so each request gets its own client.
 * Hyperdrive keeps the real Postgres connections pooled, so this is cheap.
 */
export function createDb(connectionString: string) {
  const client = postgres(connectionString, {
    // Hyperdrive recommends a small per-request pool and skipping the type-fetch round trip.
    max: 5,
    fetch_types: false,
  });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
