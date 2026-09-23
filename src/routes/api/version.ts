import { createFileRoute } from "@tanstack/react-router";

import { BUILD } from "#/lib/version";

export const Route = createFileRoute("/api/version")({
  server: {
    handlers: {
      GET: () =>
        Response.json(BUILD, {
          headers: { "Cache-Control": "no-store, max-age=0" },
        }),
    },
  },
});
