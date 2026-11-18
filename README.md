# Fontory

Fontory is a font discovery and download site. It lists open-licensed font families from the
[Google Fonts collection](https://github.com/google/fonts), with real font files, their original
licenses, and categories backed by the collection's own metadata and tags. Each family has a
detail page with a preview, per-style downloads, a license-bundled zip, and copy-ready CSS.

Current catalogue (`data/import-report.json`): 1993 families, 3693 styles.

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
| `npm run import:fetch` | Fetch pinned Google Fonts sources |
| `npm run import:build` | Build `data/fonts.json` and the import report |
| `npm run import:verify` | Verify previews and font files against the remote hosts |

## Data pipeline

1. **Fetch** (`import:fetch`): sparse-clones `google/fonts` at the commit pinned in
   `scripts/import/sources.json`, keeping only `METADATA.pb`, tags, and license files. The clone
   goes to `.cache/sources/google-fonts` (gitignored).
2. **Build** (`import:build`): parses metadata, assigns categories from evidence only, validates
   each family, dedupes, and writes `data/fonts.json` and `data/import-report.json`.
3. **Verify** (`import:verify`): for each family, checks the preview stylesheet on
   `fonts.googleapis.com` and the font files on `raw.githubusercontent.com`, and writes
   `data/verify-report.json`. Requests go through curl and honour `HTTPS_PROXY`.

The generated data files are committed so the site builds without network access.

## Deploy to Vercel

1. In Vercel, import the GitHub repository as a new project. The framework preset is Next.js.
   Build and output settings stay at their defaults.
2. Node version: Vercel uses the `engines.node` range from `package.json` (`>=20.9.0`).
3. Environment variables: none are required.
   - `VERCEL_PROJECT_PRODUCTION_URL` is set by Vercel. `siteUrl()` in `src/lib/site-url.ts` uses
     it for `metadataBase` (`src/app/layout.tsx`, which Open Graph URLs resolve against), the
     sitemap URLs (`src/app/sitemap.ts`), and the `Sitemap:` line in `robots.txt`
     (`src/app/robots.ts`). The site sets no canonical link tags.
   - `NEXT_PUBLIC_SITE_URL` is an optional override. Precedence, first match wins:
     1. `VERCEL_PROJECT_PRODUCTION_URL`, if set and non-empty. Its value is a bare host and is
        prefixed with `https://`.
     2. `NEXT_PUBLIC_SITE_URL`, with trailing slashes removed.
     3. `http://localhost:3000`.
   - Because Vercel always sets the first variable, `NEXT_PUBLIC_SITE_URL` takes effect only
     when `VERCEL_PROJECT_PRODUCTION_URL` is unset (for example, on a host other than Vercel).
     To serve a custom domain on Vercel, assign it to the Production environment in the project's
     domain settings.
4. Prerendering and on-demand pages. `src/app/font/[slug]/page.tsx` and
   `src/app/api/family/[slug]/route.ts` both use the same list of 24 slugs (`PRERENDER_SLUGS`,
   all present in `data/fonts.json`). Those are rendered at build time through
   `generateStaticParams`. Both routes set `dynamic = "force-static"`, `dynamicParams = true` and
   `revalidate = false`, so every other slug is rendered on the first request and then cached
   with no time-based revalidation until the next deployment. Unknown slugs return 404: the page
   calls `notFound()`, and the API returns `{"error":"Not found"}` with status 404. The two slug
   lists must be kept in sync by hand.
5. `data/fonts.json` is read at runtime with `fs` (`src/lib/data.ts`), which file tracing cannot
   detect. `next.config.ts` adds it to the server functions for `/font/[slug]` and
   `/api/family/[slug]` through `outputFileTracingIncludes`.
6. Font files are not hosted on Vercel. Download links point to `raw.githubusercontent.com` at
   the pinned `google/fonts` commit (`styles[].url` and `licenseUrl` in `data/fonts.json`). Preview
   stylesheets load from `fonts.googleapis.com` in the browser (`src/lib/google-css.ts`,
   `src/lib/useFontStylesheet.ts`).

### Updating the catalogue

1. Optional: change `googleFonts.commit` in `scripts/import/sources.json` to the new pin.
2. `npm run import:fetch`, then `npm run import:build`, then `npm run import:verify`.
3. Commit the changed `data/*.json` files (`fonts.json`, `import-report.json`,
   `verify-report.json`) and redeploy. With Vercel's Git integration, a push to the production
   branch starts a deployment.

## Licensing

Font files are redistributed unmodified from the Google Fonts collection. Each family is
licensed under its own terms (SIL Open Font License 1.1, Apache License 2.0, or Ubuntu Font
Licence 1.0). The license file for each family is included in its download and linked from its
page. Fontory's own code is separate from the fonts it lists.
