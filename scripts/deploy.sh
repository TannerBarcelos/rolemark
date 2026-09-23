#!/usr/bin/env bash
# Deploys a built dist/ directory to production.
#
# STUB: no hosting target is chosen yet. Replace the body below with the
# host's deploy command (e.g. `wrangler deploy`, `flyctl deploy`, an rsync, or
# a container push). Deploy the given directory as-is; never rebuild here, or
# the build identity changes.
set -euo pipefail

dist_dir="${1:?usage: deploy.sh <dist-dir>}"

if [ ! -f "$dist_dir/server/wrangler.json" ]; then
  echo "error: $dist_dir does not look like a build (missing server/wrangler.json)" >&2
  exit 1
fi

echo "STUB deploy of build ${APP_BUILD_SEQ:-?} (${APP_BUILD_ID:-unknown})"
echo "Contents of $dist_dir:"
find "$dist_dir" -maxdepth 2 | sort
