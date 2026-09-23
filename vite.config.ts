import { execSync } from "node:child_process";

import { defineConfig } from "vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";

// Build identity, shared by the client and server bundles. The client bakes it
// in at build time; the server reports it from /api/version. `time` orders
// builds so a tab only prompts when the server is strictly newer. CI pins both
// values (see .github/workflows/ci.yml); local builds fall back to git + now.
function resolveBuildId(): string {
  if (process.env.APP_BUILD_ID) return process.env.APP_BUILD_ID;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "local";
  }
}

function resolveBuildTime(): number {
  const fromEnv = Number(process.env.APP_BUILD_TIME);
  return Number.isSafeInteger(fromEnv) && fromEnv > 0 ? fromEnv : Date.now();
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  define: {
    __APP_BUILD_ID__: JSON.stringify(resolveBuildId()),
    __APP_BUILD_TIME__: JSON.stringify(resolveBuildTime()),
  },
  plugins: [tanstackStart(), viteReact()],
});

export default config;
