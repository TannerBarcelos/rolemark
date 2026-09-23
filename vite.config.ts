import { execSync } from "node:child_process";

import { defineConfig } from "vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";

// One ID per build, shared by the client and server bundles. The client bakes
// it in at build time; the server reports it from /api/version. When they
// differ, the open tab is running stale code.
function resolveBuildId(): string {
  const fromEnv = process.env.APP_BUILD_ID ?? process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv;

  const stamp = Date.now().toString(36);
  try {
    const sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    return `${sha}-${stamp}`;
  } catch {
    return stamp;
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  define: {
    __APP_BUILD_ID__: JSON.stringify(resolveBuildId()),
  },
  plugins: [tanstackStart(), viteReact()],
});

export default config;
