import { createFileRoute, useRouter } from "@tanstack/react-router";

import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { session } = Route.useRouteContext();
  const router = useRouter();

  const signOut = async () => {
    await authClient.signOut();
    // Re-run beforeLoad so the guard sees the cleared session and redirects to /login.
    await router.invalidate();
  };

  return (
    <main>
      <h1>Welcome, {session.user.name}</h1>
      <p>Signed in as {session.user.email}</p>
      <button type="button" onClick={signOut}>
        Sign out
      </button>
    </main>
  );
}
