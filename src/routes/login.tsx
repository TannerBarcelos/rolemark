import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { authClient } from "#/lib/auth-client";
import { sanitizeRedirect } from "#/lib/redirect";

export const Route = createFileRoute("/login")({
  validateSearch: (search) => ({
    redirect: sanitizeRedirect(search.redirect),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.session) {
      throw redirect({ href: search.redirect });
    }
  },
  component: Login,
});

function Login() {
  const { redirect: callbackURL } = Route.useSearch();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setPending(true);
    setError(null);
    // Redirects the browser to Google; on success Google returns to
    // /api/auth/callback/google, which sets the session cookie and sends the user to callbackURL.
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      errorCallbackURL: "/login",
    });
    if (error) {
      setError(error.message ?? "Sign in failed. Please try again.");
      setPending(false);
    }
  };

  return (
    <main>
      <h1>Sign in to RoleMark</h1>
      <button type="button" onClick={signInWithGoogle} disabled={pending}>
        {pending ? "Redirecting…" : "Continue with Google"}
      </button>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
