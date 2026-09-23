import { createFileRoute, useRouter } from "@tanstack/react-router";

import { getLinkedProviders } from "#/functions/account.functions";
import { authClient } from "#/auth/auth-client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: () => getLinkedProviders(),
  component: Dashboard,
});

function Dashboard() {
  const { session } = Route.useRouteContext();
  const providers = Route.useLoaderData();
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
      <p>Linked sign-in methods: {providers.join(", ")}</p>
      <button type="button" onClick={signOut}>
        Sign out
      </button>
    </main>
  );
}
