import { createFileRoute } from "@tanstack/react-router";

import { getAuth } from "#/lib/auth.server";

// Mounts every Better Auth endpoint (OAuth redirect, callback, session, sign-out) under /api/auth/*.
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => getAuth().handler(request),
      POST: ({ request }) => getAuth().handler(request),
    },
  },
});
