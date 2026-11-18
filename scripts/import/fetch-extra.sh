#!/usr/bin/env bash
# Idempotent, pinned, blob-filtered sparse clones for the fontsource and theleagueof sources (see sources.json).
# Layout: .cache/sources/fontsource/font-files (fonts/other/ only), .cache/sources/theleagueof/<repo> (full tree, no blobs until checkout).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CACHE="${ROOT}/.cache/sources"
PINS="${ROOT}/scripts/import/sources.json"

# pin_of <repo-key-or-league-repo>  -> prints the pinned commit
pin_of() {
  node -e "
    const s = require('${PINS}');
    const repo = process.argv[1];
    if (repo === 'fontsource/font-files') { console.log(s.fontsource.commit); process.exit(0); }
    const hit = (s.league || []).find((l) => l.repo === repo);
    if (!hit) { console.error('no pin for ' + repo); process.exit(1); }
    console.log(hit.commit);
  " "$1"
}

# clone_pinned <github-owner/repo> <dest> <sha> [sparse-dir]
clone_pinned() {
  local repo="$1" dest="$2" sha="$3" sparse="${4:-}"
  local url="https://github.com/${repo}.git"

  if [ -d "${dest}/.git" ]; then
    local head
    head="$(git -C "${dest}" rev-parse HEAD 2>/dev/null || echo none)"
    if [ "${head}" = "${sha}" ]; then
      echo "${repo} already at ${sha}, skipping"
      return 0
    fi
    echo "${repo} present at ${head}, re-pinning to ${sha}"
  else
    rm -rf "${dest}"
    mkdir -p "$(dirname "${dest}")"
    git clone --depth 1 --filter=blob:none --sparse --no-checkout "${url}" "${dest}"
  fi

  if [ -n "${sparse}" ]; then
    git -C "${dest}" sparse-checkout set "${sparse}"
  else
    git -C "${dest}" sparse-checkout disable 2>/dev/null || true
  fi
  git -C "${dest}" fetch --depth 1 --filter=blob:none origin "${sha}"
  git -C "${dest}" checkout --force "${sha}"
  echo "${repo} checked out at ${sha}"
}

clone_pinned "fontsource/font-files" "${CACHE}/fontsource/font-files" "$(pin_of fontsource/font-files)" "fonts/other"

for repo in theleagueof/blackout theleagueof/chunk theleagueof/junction theleagueof/ostrich-sans; do
  clone_pinned "${repo}" "${CACHE}/${repo}" "$(pin_of "${repo}")"
done
