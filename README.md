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

- **CI** (`.github/workflows/ci.yml`) checks every pull request. Its builds
  are never deployed.
- **CD** (`.github/workflows/cd.yml`) runs only on pushes to `main`: it
  checks, builds once, and deploys that artifact via `scripts/deploy.sh`
  (currently a stub). Set the `PRODUCTION_URL` repository variable to have CD
  confirm the live build after deploying.

Every deployed build carries an identity (`APP_BUILD_ID` = commit SHA,
`APP_BUILD_SEQ` = CD run number) that the client compares against
`GET /api/version`. When the server is serving a newer build, open tabs show a
reload banner and the next in-app navigation does a full page load.

- Deploy the `dist` artifact CD builds; don't rebuild per environment.
- Roll back by reverting the commit on `main`, not by redeploying an old
  artifact. An old artifact has a lower run number, so open tabs won't be told
  to reload.
- Don't rename `cd.yml`: its run number would restart at 1.
