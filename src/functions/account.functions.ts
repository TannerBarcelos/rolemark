import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";

import { account } from "#/db/schema";
import { authMiddleware } from "#/auth/auth.middleware";
import { getDb } from "#/auth/auth.server";

/** Sign-in providers linked to the current user (e.g. ["google"]). */
export const getLinkedProviders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const rows = await getDb()
      .select({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, context.user.id));
    return rows.map((row) => row.providerId);
  });
