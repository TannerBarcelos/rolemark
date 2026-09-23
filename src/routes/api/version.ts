import { createFileRoute } from "@tanstack/react-router";

import { BUILD_ID, type VersionResponse } from "#/lib/version";

export const Route = createFileRoute("/api/version")({
  server: {
    handlers: {
      GET: () =>
        Response.json({ buildId: BUILD_ID } satisfies VersionResponse, {
          headers: { "Cache-Control": "no-store, max-age=0" },
        }),
    },
  },
});
