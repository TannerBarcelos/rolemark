# Branches, releases, and version drift

## Rules for agents

- Branch from `develop` and open PRs into `develop`. Never push to `develop` or `main` directly.
- PRs into `main` only come from `develop` (a release) or `hotfix/*`; the `release-source` check
  enforces this.
- Before pushing, run the CI check locally (see "Done means CI passes" in `AGENTS.md`).
- Never rename `.github/workflows/cd.yml`: its run number is the build sequence.
- Deploys happen only through CD. Never run `bun run deploy` or `wrangler deploy` against staging
  or production unless explicitly asked.

## Branches

| Branch    | Role                                    | Receives PRs from                | Deploys to   |
| --------- | --------------------------------------- | -------------------------------- | ------------ |
| `develop` | Staging: stable, next release candidate | feature branches                 | `staging`    |
| `main`    | Production                              | `develop` (releases), `hotfix/*` | `production` |

## Flow

1. Branch from `develop`, open a PR back into `develop`. CI must pass and the
   branch must be up to date.
2. Merging deploys to **staging**. Verify there.
3. To release, open a PR **`develop` → `main`** (merge commit). The
   `release-source` check rejects PRs into `main` from anything other than
   `develop` or `hotfix/*`.
4. Merging deploys to **production**.

**Hotfixes** skip staging when production can't wait for the next release:

1. Branch `hotfix/<name>` from `main` and open a PR into `main`.
2. Merging deploys to production.
3. Open a second PR from the same `hotfix/<name>` branch into `develop`. Without it, the next
   release from `develop` undoes the fix.

- **CI** (`.github/workflows/ci.yml`) checks every pull request. Its builds
  are never deployed.
- **CD** (`.github/workflows/cd.yml`) runs only on pushes to `develop` and
  `main`: it checks, builds once, and deploys that artifact via
  `scripts/deploy.sh` (currently a stub; see "Deploying to Cloudflare" for the
  manual steps). Set a `DEPLOY_URL` variable on each GitHub environment to have
  CD confirm the live build after deploying.

Every deployed build carries an identity (`APP_BUILD_ID` = commit SHA,
`APP_BUILD_SEQ` = CD run number) that the client compares against
`GET /api/version`. When the server is serving a newer build, open tabs show a
reload banner and the next in-app navigation does a full page load.

- Deploy the `dist` artifact CD builds; don't rebuild it by hand.
- Roll back by reverting on `develop` and releasing (or a `hotfix/*` revert when
  it's urgent), not by redeploying an old
  artifact. An old artifact has a lower run number, so open tabs won't be told
  to reload.
- Don't rename `cd.yml`: its run number would restart at 1.
