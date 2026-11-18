# Fontory

Fontory is a font discovery and download site. It lists open-licensed font families from four
collections: Google Fonts, The League of Moveable Type, Velvetyne and Fontsource (see
[Sources](#sources)). Each family has real font files with their original license, categories backed
by evidence (metadata or tags), a detail page with a preview, per-style downloads, a license-bundled
zip, and copy-ready CSS.

Current catalogue (`data/import-report.json`, `totals.byCollection`): 2078 families and 3877 styles.

| Collection | Families | Styles |
| --- | --- | --- |
| Google Fonts (`google/fonts`) | 2029 | 3755 |
| The League of Moveable Type | 10 | 17 |
| Velvetyne | 31 | 50 |
| Fontsource (`fontsource/font-files`) | 8 | 55 |

## Stack

- Next.js 16.4.6 (App Router), React 19.2.9, TypeScript 5.9.3
- Tailwind CSS 4.3.5 (`@tailwindcss/postcss` 4.3.5)
- fflate 0.8.2 for zip packaging in the browser
- Vitest 4.1.12 for unit tests, Playwright 1.63.0 for end-to-end tests
- ESLint 10.15.0 with eslint-config-next 16.4.6
- Node.js >=20.9.0 (`engines` in `package.json`)

## Design

Set in Newsreader, Geist and Geist Mono via `next/font` (`src/app/layout.tsx`).

## Setup

```sh
npm install
```

The repo sets `legacy-peer-deps=true` in `.npmrc`. npm 10 otherwise fails to resolve the peer
dependency graph for this stack (the same setting applies on Vercel's install step).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run e2e` | End-to-end tests (Playwright, against the production server) |
| `npm run import:fetch` | Fetch the pinned sources of all four collections (`fetch-sources.sh`, `fetch-extra.sh`, `fetch-velvetyne.sh`) |
| `npm run import:build` | Build `data/fonts.json`, `data/import-report.json` and `public/fontface/*.css` (vendors Velvetyne files) |
| `npm run import:verify` | Verify previews, font files and licenses against the remote hosts and the vendored files |

## Data pipeline

1. **Fetch** (`import:fetch`): clones every source at its pin (see [Sources](#sources)) into
   `.cache/sources/` (gitignored). Velvetyne projects are fetched from GitLab by commit.
2. **Build** (`import:build`): reads the clones (no network), validates each family, assigns
   categories from evidence only, dedupes across collections, and writes `data/fonts.json`,
   `data/import-report.json`, the vendored Velvetyne files under `public/fonts/velvetyne/`, and one
   `public/fontface/<slug>.css` per family with `preview: 'fontface'`.
3. **Verify** (`import:verify`): checks each family's remote files and previews and writes
   `data/verify-report.json`. Requests go through curl and honour `HTTPS_PROXY`. A family that
   fails is excluded on the next build (`verify: <reason>` in the report).
   - Google css2 previews: `fonts.googleapis.com` must answer 200. HTTP 400 is not a failure: the
     family is recorded in `css2Unavailable` and previewed from its raw TTF files through
     `/fontface/<slug>.css` instead (37 families at the current pin).
   - Every style file (and `previewUrl`) must answer 200 to HEAD on `raw.githubusercontent.com`
     and start with a font signature (TrueType, OpenType, `true`, WOFF2 or WOFF). Vendored
     `/fonts/...` files must exist under `public/` and carry the same signature.
   - Each license file must exist (remote 200, or vendored file present).

A verify report only applies to the pins it was run against (`pins` hash of `sources.json` and
`velvetyne-pins.json`). After changing a pin, run the four steps again in order.

The generated data files are committed so the site builds without network access.

## Sources

Every collection is pinned. The commits are in `scripts/import/sources.json` and
`scripts/import/sources/velvetyne-pins.json`.

- **Google Fonts**: [`google/fonts`](https://github.com/google/fonts) at
  `5bd87dfc525c8a0d1d8529d3684716e00c3fc59a`. Licenses: OFL 1.1 (`OFL.txt`), Apache 2.0
  (`LICENSE.txt`), Ubuntu Font Licence 1.0 (`UFL.txt`), read from the license file in each family
  directory. Previews use the Google css2 API, except families it refuses (see Data pipeline).
- **The League of Moveable Type**: `theleagueof/blackout` `4864cfc1749590e9f78549c6e57116fe98480c0f`,
  `theleagueof/chunk` `12a243f3fb7c7a68844901023f7d95d6eaf14104`, `theleagueof/junction`
  `fb73260e86dd301b383cf6cc9ca8e726ef806535`, `theleagueof/ostrich-sans`
  `a949d40d0576d12ba26e2a45e19c91fd0228c964`. Files come from `raw.githubusercontent.com`, OTF
  preferred over TTF. Repositories without built binaries are skipped.
- **Velvetyne**: [`gitlab.com/velvetyne`](https://gitlab.com/velvetyne), one pinned commit per
  project (default-branch HEAD at pin time, `velvetyne-pins.json`). A project is imported only when
  its license file is verbatim SIL OFL 1.1 (checked by hash of the license text) and it ships font
  files. GitLab raw has no CORS header, so the files are vendored unmodified into
  `public/fonts/velvetyne/<slug>/` together with the project's license file. Each family downloads
  its OTF (else TTF) and uses its WOFF2 for the preview where the project ships one. The vendored
  total is capped at 60 MB.
- **Fontsource**: [`fontsource/font-files`](https://github.com/fontsource/font-files) at
  `5a72889057f592bb0659629e38337359f94d53b2`, `fonts/other/<id>` only. A family needs
  `metadata.json` with a license and a `LICENSE` file. Fontsource files are WOFF2 subsets, so
  the importer takes the `latin` subset (or the only subset) and excludes families split into
  several unicode-range subsets. **Excluded: any family whose LICENSE contains "Reserved Font
  Name"**. Their files are converted and subset, which the OFL forbids under the original name.
- **Upstreams** (`upstreams` in `import-report.json`): IBM/plex, rsms/inter, tonsky/FiraCode,
  JetBrains/JetBrainsMono and fontsource/fontsource are checked for coverage and license only. Nothing is imported from
  them a second time (Fontsource's own mirror is dedupe-only).

Dedupe across collections compares the normalized family name (lowercase, `a-z0-9` only) and the
slug. Priority: Google Fonts, then The League, Velvetyne, Fontsource. The report lists every
duplicate with the copy that was kept.

Excluded families, with their collection and reason, are listed in `data/import-report.json`.

## Deploy to Vercel

1. In Vercel, import the GitHub repository as a new project. The framework preset is Next.js.
   Build and output settings stay at their defaults.
2. Node version: Vercel uses the `engines.node` range from `package.json` (`>=20.9.0`).
3. Environment variables: none are required.
   - `VERCEL_PROJECT_PRODUCTION_URL` is set by Vercel. `siteUrl()` in `src/lib/site-url.ts` uses
     it for `metadataBase` (`src/app/layout.tsx`, which Open Graph URLs resolve against), the
     sitemap URLs (`src/app/sitemap.ts`), and the `Sitemap:` line in `robots.txt`
     (`src/app/robots.ts`). The site sets no canonical link tags.
   - `NEXT_PUBLIC_SITE_URL` is an optional override. Precedence, first non-empty value wins:
     1. `NEXT_PUBLIC_SITE_URL`, trimmed, with trailing slashes removed.
     2. `VERCEL_PROJECT_PRODUCTION_URL`, a bare host that is prefixed with `https://`.
     3. `http://localhost:3000`.
   - Setting `NEXT_PUBLIC_SITE_URL` therefore overrides the URL that Vercel sets. Without it, Vercel's
     production URL is used. To serve a custom domain on Vercel, assign it to the Production
     environment in the project's domain settings.
4. Prerendering and on-demand pages. `src/app/font/[slug]/page.tsx` and
   `src/app/api/family/[slug]/route.ts` both import the same list of 24 slugs (`PRERENDER_SLUGS`
   in `src/lib/prerender.ts`, all present in `data/fonts.json`). Those are rendered at build time through
   `generateStaticParams`. Both routes set `dynamic = "force-static"`, `dynamicParams = true` and
   `revalidate = false`, so every other slug is rendered on the first request and then cached
   with no time-based revalidation until the next deployment. Unknown slugs return 404: the page
   calls `notFound()`, and the API returns `{"error":"Not found"}` with status 404.
5. `data/fonts.json` is read at runtime with `fs` (`src/lib/data.ts`), which file tracing cannot
   detect. `next.config.ts` adds it to the server functions for `/font/[slug]` and
   `/api/family/[slug]` through `outputFileTracingIncludes`.
6. Most font files are not hosted on Vercel. Google, League and Fontsource download links point to
   `raw.githubusercontent.com` at the pinned commit (`styles[].url` and `licenseUrl` in
   `data/fonts.json`). Velvetyne files are vendored under `public/fonts/velvetyne/` and served from
   the site. CSS2 previews load from `fonts.googleapis.com` in the browser (`src/lib/google-css.ts`,
   `src/lib/useFontStylesheet.ts`); `preview: 'fontface'` families load `public/fontface/<slug>.css`.

### Updating the catalogue

1. Optional: change a pin in `scripts/import/sources.json` (Google Fonts, Fontsource, League) or
   run `scripts/import/fetch-velvetyne.sh --pin` for Velvetyne.
2. `npm run import:fetch`, then `npm run import:build`, then `npm run import:verify`, then
   `npm run import:build` again (the second build applies the verify result).
3. Commit the changed `data/*.json` files (`fonts.json`, `import-report.json`,
   `verify-report.json`), `public/fontface/` and `public/fonts/velvetyne/`, then redeploy. With Vercel's Git integration, a push to the production
   branch starts a deployment.

## Licensing

Each family keeps its own license. Licenses are read from the license file in the source, not
from a name or label. Current licenses: SIL Open Font License 1.1, Apache License 2.0, Ubuntu
Font Licence 1.0, MIT, CC0 and The Unlicense (Fontsource). The license file is included in each
family's zip, with a README that names the source repository and URL, and is linked from its page.

Rules applied by the importer:

- Google Fonts, The League: files are downloaded from the pinned commit as published.
- Velvetyne: only projects whose license file is verbatim OFL 1.1. Files are vendored unmodified.
- Fontsource: families whose LICENSE contains "Reserved Font Name" are excluded (OFL forbids
  redistributing converted or subset files under the original name).
- Categories come only from metadata and tags. A family with no evidence is uncategorized.

Fontory's own code is separate from the fonts it lists.
