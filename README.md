# Fontory

Fontory is a font discovery and download site. It lists open-licensed font families from the
[Google Fonts collection](https://github.com/google/fonts), with real font files, their original
licenses, and categories backed by the collection's own metadata and tags. Each family has a
detail page with a preview, per-style downloads, a license-bundled zip, and copy-ready CSS.

## Stack

- Next.js 16 (App Router, static generation), React 19, TypeScript
- Tailwind CSS v4
- fflate for zip packaging in the browser
- Vitest for unit tests, Playwright for end-to-end tests
- Deployed as a static site

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
| `npm run import:verify` | Verify preview availability against the remote host |

## Data pipeline

1. **Fetch** (`import:fetch`): sparse-clones `google/fonts` at the commit pinned in
   `scripts/import/sources.json`, keeping only `METADATA.pb`, tags, and license files.
2. **Build** (`import:build`): parses metadata, assigns categories from evidence only, validates
   each family, dedupes, and writes `data/fonts.json` and `data/import-report.json`.
3. **Verify** (`import:verify`): checks each family's preview request and writes
   `data/verify-report.json`.

The generated data files are committed so the site builds without network access.

## Licensing

Font files are redistributed unmodified from the Google Fonts collection. Each family is
licensed under its own terms (SIL Open Font License 1.1, Apache License 2.0, or Ubuntu Font
Licence 1.0). The license file for each family is included in its download and linked from its
page. Fontory's own code is separate from the fonts it lists.
