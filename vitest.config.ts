import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Separate from vite.config.ts: the app build's Cloudflare and TanStack Start plugins aren't
// needed to run tests. Three projects, picked by file name (docs/testing.md):
//   *.test.ts          → unit     (Node; pure logic)
//   *.test.tsx         → dom      (happy-dom; components and hooks)
//   *.worker.test.ts   → workers  (workerd with wrangler.jsonc bindings; server code)
export default defineConfig({
  resolve: { tsconfigPaths: true },
  define: {
    __APP_BUILD_ID__: JSON.stringify("test"),
    __APP_BUILD_SEQ__: JSON.stringify(1),
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.worker.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        plugins: [viteReact()],
        test: {
          name: "dom",
          include: ["src/**/*.test.tsx"],
          environment: "happy-dom",
          setupFiles: ["./src/test/setup-dom.ts"],
        },
      },
      {
        extends: true,
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.jsonc" },
            // The pool's bundled workerd trails wrangler.jsonc's compatibility_date. Drop this
            // override once `bun run test` passes without it.
            miniflare: { compatibilityDate: "2026-08-22" },
          }),
        ],
        test: {
          name: "workers",
          include: ["src/**/*.worker.test.ts"],
        },
      },
    ],
  },
});
