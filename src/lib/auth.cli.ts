// Entry point for `bun run auth:generate` only; never imported by the app.
// The CLI inspects the config to build the schema and never opens a connection.
import { createDb } from "#/db/client";
import { createAuth } from "#/lib/auth";

export const auth = createAuth(createDb("postgres://localhost/unused"), {
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "cli-schema-generation-only-not-a-real-secret",
  GOOGLE_CLIENT_ID: "unused",
  GOOGLE_CLIENT_SECRET: "unused",
});
