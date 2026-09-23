#!/usr/bin/env bash
# Deploys a built dist/ directory to an environment (staging or production).
#
# STUB: replace the body below with the real deploy, e.g.
#   bunx wrangler deploy --config "$dist_dir/server/wrangler.json"
# with CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID from the GitHub
# environment's secrets. Deploy the given directory as-is; never rebuild here,
# or the build identity changes.
set -euo pipefail

environment="${1:?usage: deploy.sh <staging|production> <dist-dir>}"
dist_dir="${2:?usage: deploy.sh <staging|production> <dist-dir>}"

case "$environment" in
  staging | production) ;;
  *)
    echo "error: unknown environment '$environment'" >&2
    exit 1
    ;;
esac

if [ ! -f "$dist_dir/server/wrangler.json" ]; then
  echo "error: $dist_dir does not look like a build (missing server/wrangler.json)" >&2
  exit 1
fi

echo "STUB deploy to $environment of build ${APP_BUILD_SEQ:-?} (${APP_BUILD_ID:-unknown})"
echo "Contents of $dist_dir:"
find "$dist_dir" -maxdepth 2 | sort
