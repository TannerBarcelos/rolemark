import { createAuthClient } from "better-auth/react";

// Same-origin: requests go to /api/auth/* on whatever host serves the app.
export const authClient = createAuthClient();
