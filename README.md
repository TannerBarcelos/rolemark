# RoleMark

A minimal TanStack Start app with one route and plain CSS.

```bash
bun install
bun --bun run dev
```

Edit `src/routes/index.tsx` to get started. Add route files under
`src/routes`; TanStack Router updates `src/routeTree.gen.ts` for you.

Build the production app with:

```bash
bun --bun run build
```

## Deploys and version drift

Every build carries an identity (`APP_BUILD_ID` = commit SHA, `APP_BUILD_SEQ` =
CI run number) that the client compares against `GET /api/version`. When the
server is serving a newer build, open tabs show a reload banner and the next
in-app navigation does a full page load.

- Deploy the `dist` artifact CI uploads; don't rebuild per environment.
- Roll back by reverting the commit on `main`, not by redeploying an old
  artifact. An old artifact has a lower run number, so open tabs won't be told
  to reload.
