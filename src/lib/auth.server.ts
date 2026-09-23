import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { db } from "#/db/index.server";
import * as schema from "#/db/schema";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      // Always show the account chooser so users can switch Google accounts.
      prompt: "select_account",
    },
  },
  session: {
    // Cache the session in a signed cookie so most reads skip the database.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  // Must stay last: forwards Set-Cookie headers from server functions.
  plugins: [tanstackStartCookies()],
});

export type Session = typeof auth.$Infer.Session;
