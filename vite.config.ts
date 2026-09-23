import { execSync } from "node:child_process";

import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import tailwindcss from "@tailwindcss/vite";
import agents from "agents/vite";

import viteReact from "@vitejs/plugin-react";

// Build identity, shared by the client and server bundles. The client bakes it
// in at build time; the server reports it from /api/version. `seq` orders
// builds so a tab only prompts when the server is strictly newer. CI pins both
// values (see .github/workflows/cd.yml). Local builds get seq 0, so they never
// count as newer than a CI build.
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

function resolveBuildSeq(): number {
  const fromEnv = Number(process.env.APP_BUILD_SEQ);
  return Number.isSafeInteger(fromEnv) && fromEnv > 0 ? fromEnv : 0;
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  define: {
    __APP_BUILD_ID__: JSON.stringify(resolveBuildId()),
    __APP_BUILD_SEQ__: JSON.stringify(resolveBuildSeq()),
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    // Compiles the Agents SDK's @callable() decorators (docs/integrations.md#ai-features).
    agents(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
