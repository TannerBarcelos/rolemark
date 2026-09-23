import { createFileRoute } from "@tanstack/react-router";

import { auth } from "#/lib/auth.server";

// Mounts every Better Auth endpoint (OAuth redirect, callback, session, sign-out) under /api/auth/*.
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
