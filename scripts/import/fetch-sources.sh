#!/usr/bin/env bash
# Idempotent sparse checkout of google/fonts at the pinned commit (see sources.json).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SHA="$(node -e "console.log(require('${ROOT}/scripts/import/sources.json').googleFonts.commit)")"
REPO_URL="https://github.com/google/fonts.git"
DEST="${ROOT}/.cache/sources/google-fonts"

if [ -d "${DEST}/.git" ]; then
  HEAD_SHA="$(git -C "${DEST}" rev-parse HEAD 2>/dev/null || echo none)"
  if [ "${HEAD_SHA}" = "${SHA}" ]; then
    echo "google-fonts already at ${SHA}, skipping"
    exit 0
  fi
  echo "google-fonts present at ${HEAD_SHA}, re-pinning to ${SHA}"
else
  mkdir -p "$(dirname "${DEST}")"
  rm -rf "${DEST}"
  git clone --depth 1 --filter=blob:none --sparse --no-checkout "${REPO_URL}" "${DEST}"
fi

git -C "${DEST}" sparse-checkout set --no-cone '/*/*/METADATA.pb' '/tags/' '/*/*/OFL.txt' '/*/*/LICENSE.txt' '/*/*/UFL.txt'
git -C "${DEST}" fetch --depth 1 origin "${SHA}"
git -C "${DEST}" checkout --force "${SHA}"
echo "google-fonts checked out at ${SHA}"
