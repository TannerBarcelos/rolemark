import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import type { Db } from "#/db/client";
import * as schema from "#/db/schema";

export interface AuthEnv {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

/** Pure factory with no runtime globals, so both the Worker and the Better Auth CLI can use it. */
export function createAuth(db: Db, env: AuthEnv) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        // Always show the account chooser so users can switch Google accounts.
        prompt: "select_account",
      },
    },
    account: {
      // Sign-ins from trusted providers with the same verified email attach to the existing user
      // instead of creating a duplicate. Add providers here only if they verify email ownership.
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },
    session: {
      // Cache the session in a signed cookie so most reads skip the database.
      // Trade-off: a revoked session stays valid on other devices for up to maxAge.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    // Must stay last: forwards Set-Cookie headers from server functions.
    plugins: [tanstackStartCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
