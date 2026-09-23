import { createFileRoute, redirect } from "@tanstack/react-router";

// Pathless layout: every route under src/routes/_authenticated/ requires a session.
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    if (!context.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    // Narrow the type for child routes.
    return { session: context.session };
  },
});
