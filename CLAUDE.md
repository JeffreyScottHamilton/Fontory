# Fontory

## Learned
- Run `npm run build`, `next start` and Playwright only under `flock .ultimatum/build.lock bash -c '...'`; parallel builds corrupt `.next/`.
- Font families come only from `data/fonts.json` (google/fonts pinned in `scripts/import/sources.json`); regenerate via the import pipeline, never hand-edit.
- Family zip logic lives in `src/lib/family-zip.ts`; reuse it, do not re-implement zipping in components.
- Keep `dynamic`, `dynamicParams` and `revalidate` in `src/app/font/[slug]/page.tsx` and `src/app/api/family/[slug]/route.ts` as literal exports (Next reads them statically).
- Run Playwright with `E2E_PORT=<free port> E2E_FRESH=1` so it starts a fresh server; port 3100 may hold a stale `next start` serving an old build.
- New font collections: license is verified from the license file text; Fontsource families whose LICENSE has a "Reserved Font Name" are excluded (their files are converted, i.e. modified).
