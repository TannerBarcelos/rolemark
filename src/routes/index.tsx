import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { session } = Route.useRouteContext();

  return (
    <main>
      <h1>Welcome to RoleMark</h1>
      {session ? (
        <Link to="/dashboard">Go to dashboard</Link>
      ) : (
        <Link to="/login" search={{ redirect: "/dashboard" }}>
          Sign in
        </Link>
      )}
    </main>
  );
}
