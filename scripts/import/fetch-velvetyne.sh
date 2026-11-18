#!/usr/bin/env bash
# Velvetyne (gitlab.com/velvetyne) fetch.
#   fetch-velvetyne.sh          clone every project in velvetyne-pins.json at its pinned sha (idempotent)
#   fetch-velvetyne.sh --pin    re-pin: query the GitLab API for each group project's default-branch HEAD,
#                               rewrite velvetyne-pins.json, then fetch.
# GitLab raw has no CORS, so the app never fetches these at runtime; files are vendored by vendor step.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PINS="${ROOT}/scripts/import/sources/velvetyne-pins.json"
DEST="${ROOT}/.cache/sources/velvetyne"
API="https://gitlab.com/api/v4"
GROUP="velvetyne"

# curl wrapper with backoff for rate limiting (429) and transient 5xx.
api_get() {
  local url="$1" out="$2" attempt code
  for attempt in 1 2 3 4 5 6; do
    code="$(curl -sS -o "${out}" -w '%{http_code}' "${url}")" || code="000"
    if [ "${code}" = "200" ]; then return 0; fi
    if [ "${code}" = "429" ] || [ "${code}" = "000" ] || [ "${code:0:1}" = "5" ]; then
      echo "  HTTP ${code} for ${url}; retry ${attempt}" >&2
      sleep $((attempt * 20))
      continue
    fi
    echo "  HTTP ${code} for ${url}" >&2
    return 1
  done
  echo "  giving up on ${url}" >&2
  return 1
}

pin() {
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "${tmp}"' RETURN
  api_get "${API}/groups/${GROUP}/projects?per_page=100&simple=true" "${tmp}/projects.json"
  : > "${tmp}/rows.tsv"
  python3 -I -c '
import json, sys
for p in json.load(open(sys.argv[1])):
    print(p["id"], p["path"], p.get("default_branch") or "", sep="\t")
' "${tmp}/projects.json" > "${tmp}/list.tsv"
  while IFS=$'\t' read -r id path branch; do
    [ -n "${branch}" ] || { echo "  skip ${path}: no default branch" >&2; continue; }
    local enc
    enc="$(python3 -I -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "${branch}")"
    api_get "${API}/projects/${id}/repository/branches/${enc}" "${tmp}/branch.json"
    python3 -I -c '
import json, sys
b = json.load(open(sys.argv[1]))
print("\t".join([sys.argv[2], sys.argv[3], sys.argv[4], b["commit"]["id"], b["commit"]["committed_date"]]))
' "${tmp}/branch.json" "${path}" "${id}" "${branch}" >> "${tmp}/rows.tsv"
    sleep 3
  done < "${tmp}/list.tsv"
  python3 -I -c '
import json, sys
rows = []
for line in open(sys.argv[1]):
    path, pid, branch, sha, date = line.rstrip("\n").split("\t")
    rows.append({"project": path, "id": int(pid), "defaultBranch": branch, "sha": sha, "commitDate": date[:10]})
rows.sort(key=lambda r: r["project"].lower())
doc = {
    "group": sys.argv[2],
    "host": "gitlab",
    "note": "Default-branch HEAD per project at pin time. Regenerate with scripts/import/fetch-velvetyne.sh --pin.",
    "projects": rows,
}
open(sys.argv[3], "w").write(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
' "${tmp}/rows.tsv" "${GROUP}" "${PINS}"
  echo "pinned $(wc -l < "${tmp}/rows.tsv") projects to ${PINS}"
}

fetch_all() {
  mkdir -p "${DEST}"
  python3 -I -c '
import json, sys
for p in json.load(open(sys.argv[1]))["projects"]:
    print(p["project"], p["sha"], sep="\t")
' "${PINS}" > "${DEST}/.work-list.tsv"
  while IFS=$'\t' read -r path sha; do
    local dir="${DEST}/${path}"
    if [ -d "${dir}/.git" ] && [ "$(git -C "${dir}" rev-parse HEAD 2>/dev/null || echo none)" = "${sha}" ]; then
      echo "velvetyne/${path} at ${sha:0:12}, skipping"
      continue
    fi
    rm -rf "${dir}"
    mkdir -p "${dir}"
    git -C "${dir}" init -q
    git -C "${dir}" remote add origin "https://gitlab.com/${GROUP}/${path}.git"
    local attempt ok=0
    for attempt in 1 2 3 4; do
      if git -C "${dir}" fetch -q --depth 1 origin "${sha}"; then ok=1; break; fi
      echo "  fetch of velvetyne/${path} failed; retry ${attempt}" >&2
      sleep $((attempt * 5))
    done
    [ "${ok}" = "1" ] || { echo "failed: velvetyne/${path}" >&2; exit 1; }
    git -C "${dir}" checkout -q --force FETCH_HEAD
    echo "velvetyne/${path} checked out at ${sha:0:12}"
    sleep 1
  done < "${DEST}/.work-list.tsv"
  rm -f "${DEST}/.work-list.tsv"
}

if [ "${1:-}" = "--pin" ]; then
  pin
fi
fetch_all
