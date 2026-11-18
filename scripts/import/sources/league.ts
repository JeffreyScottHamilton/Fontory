// Imports The League of Moveable Type repos (github.com/theleagueof/*) from pinned clones under .cache/sources.
// Families come from an explicit table (file -> weight/style, designer quote-verified against readme.markdown).
// Prefers the .otf binary, else .ttf. Sync, no network.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { CategoryEvidence, FontFamily, FontStyle } from "../../../src/lib/types";
import {
  assertPinned,
  buildFamily,
  commitDate,
  copyrightLine,
  fullStyleName,
  mapCategory,
  normalizeName,
  readPins,
  type SourceImport,
} from "./fontsource";

const RAW_BASE = "https://raw.githubusercontent.com";
const LICENSE_FILE = "Open Font License.markdown";

export interface LeagueFace {
  base: string; // file name without extension, e.g. 'Junction-bold'
  weight: number;
  style: "normal" | "italic";
}

export interface LeagueFamily {
  family: string;
  designer: string;
  designerQuote: string; // must appear verbatim in the repo's readme.markdown
  faces: LeagueFace[];
}

export interface LeagueRepo {
  repo: string; // 'theleagueof/<name>'
  families: LeagueFamily[];
}

// Verified against each repo's readme.markdown and the font files' name tables (fc-scan / OS/2 + name IDs).
// Weights follow the style names (Light 300, Regular 400, Medium 500, Bold 700, Heavy 800, Black 900).
export const LEAGUE_TABLE: LeagueRepo[] = [
  {
    repo: "theleagueof/blackout",
    families: [
      {
        family: "Blackout Midnight",
        designer: "Tyler Finck",
        designerQuote: "by [Tyler Finck](http://www.sursly.com)",
        faces: [{ base: "Blackout Midnight", weight: 400, style: "normal" }],
      },
      {
        family: "Blackout Sunrise",
        designer: "Tyler Finck",
        designerQuote: "by [Tyler Finck](http://www.sursly.com)",
        faces: [{ base: "Blackout Sunrise", weight: 400, style: "normal" }],
      },
      {
        family: "Blackout Two AM",
        designer: "Tyler Finck",
        designerQuote: "by [Tyler Finck](http://www.sursly.com)",
        faces: [{ base: "Blackout Two AM", weight: 400, style: "normal" }],
      },
    ],
  },
  {
    repo: "theleagueof/chunk",
    families: [
      {
        family: "ChunkFive",
        designer: "Meredith Mandel",
        designerQuote: "by [Meredith Mandel](http://www.meredithmandel.com/)",
        faces: [{ base: "ChunkFive-Regular", weight: 400, style: "normal" }],
      },
      {
        family: "ChunkFive Print",
        designer: "Tyler Finck",
        designerQuote: "created by [Tyler Finck](http://www.tylerfinck.com)",
        faces: [{ base: "Chunk Five Print", weight: 400, style: "normal" }],
      },
    ],
  },
  {
    repo: "theleagueof/junction",
    families: [
      {
        family: "Junction",
        designer: "Caroline Hadilaksono & Tyler Finck",
        designerQuote: "by [Caroline Hadilaksono](http://www.hadilaksono.com) & [Tyler Finck](http://www.tylerfinck.com/)",
        faces: [
          { base: "Junction-light", weight: 300, style: "normal" },
          { base: "Junction-regular", weight: 400, style: "normal" },
          { base: "Junction-bold", weight: 700, style: "normal" },
        ],
      },
    ],
  },
  {
    repo: "theleagueof/ostrich-sans",
    families: [
      {
        family: "Ostrich Sans",
        designer: "Tyler Finck",
        designerQuote: "by [Tyler Finck](http://www.finck.co)",
        faces: [
          { base: "OstrichSans-Light", weight: 300, style: "normal" },
          { base: "OstrichSans-Medium", weight: 500, style: "normal" },
          { base: "OstrichSans-Bold", weight: 700, style: "normal" },
          { base: "OstrichSans-Heavy", weight: 800, style: "normal" },
          { base: "OstrichSans-Black", weight: 900, style: "normal" },
        ],
      },
      {
        family: "Ostrich Sans Dashed",
        designer: "Tyler Finck",
        designerQuote: "by [Tyler Finck](http://www.finck.co)",
        faces: [{ base: "OstrichSansDashed-Medium", weight: 500, style: "normal" }],
      },
      {
        family: "Ostrich Sans Inline",
        designer: "Tyler Finck",
        designerQuote: "by [Tyler Finck](http://www.finck.co)",
        faces: [
          { base: "OstrichSansInline-Regular", weight: 400, style: "normal" },
          { base: "OstrichSansInline-Italic", weight: 400, style: "italic" },
        ],
      },
      {
        family: "Ostrich Sans Rounded",
        designer: "Tyler Finck",
        designerQuote: "by [Tyler Finck](http://www.finck.co)",
        faces: [{ base: "OstrichSansRounded-Medium", weight: 500, style: "normal" }],
      },
    ],
  },
];

// Raw category values from fontsource metadata.json, keyed by normalized family name (cross-source evidence only).
function loadFontsourceCategories(fontsourceDir: string): Map<string, string> {
  const out = new Map<string, string>();
  const otherDir = path.join(fontsourceDir, "fonts", "other");
  for (const id of readdirSync(otherDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    const metaPath = path.join(otherDir, id, "metadata.json");
    if (!existsSync(metaPath)) continue;
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as { family?: unknown; category?: unknown };
    if (typeof meta.family === "string" && typeof meta.category === "string") {
      out.set(normalizeName(meta.family), meta.category);
    }
  }
  return out;
}

function binaryFor(repoDir: string, base: string): string | null {
  for (const ext of [".otf", ".ttf"]) {
    if (existsSync(path.join(repoDir, base + ext))) return base + ext;
  }
  return null;
}

// Imports one repo from an explicit clone directory. Used by importLeague and tests.
export function importLeagueRepo(
  repoDir: string,
  spec: LeagueRepo,
  commit: string,
  fontsourceCategories: Map<string, string>,
  dateAdded: string,
): { families: FontFamily[]; excluded: { id: string; reason: string }[] } {
  const name = spec.repo.split("/").pop() ?? spec.repo;
  const families: FontFamily[] = [];
  const excluded: { id: string; reason: string }[] = [];

  const licensePath = path.join(repoDir, LICENSE_FILE);
  if (!existsSync(licensePath)) {
    for (const f of spec.families) excluded.push({ id: f.family, reason: `no ${LICENSE_FILE}` });
    return { families, excluded };
  }
  const licenseText = readFileSync(licensePath, "utf8");
  if (!/SIL Open Font License,? Version 1\.1/i.test(licenseText) || !/Permission is hereby granted, free of charge/i.test(licenseText)) {
    for (const f of spec.families) excluded.push({ id: f.family, reason: "license text is not SIL OFL 1.1" });
    return { families, excluded };
  }
  const readme = existsSync(path.join(repoDir, "readme.markdown")) ? readFileSync(path.join(repoDir, "readme.markdown"), "utf8") : "";

  for (const f of spec.families) {
    if (!readme.includes(f.designerQuote)) {
      excluded.push({ id: f.family, reason: "designer quote not found in readme.markdown" });
      continue;
    }
    const styles: FontStyle[] = [];
    let missing: string | null = null;
    for (const face of f.faces) {
      const file = binaryFor(repoDir, face.base);
      if (!file) {
        missing = face.base;
        break;
      }
      styles.push({
        style: face.style,
        weight: face.weight,
        filename: file,
        fullName: fullStyleName(f.family, face.weight, face.style),
        url: `${RAW_BASE}/${spec.repo}/${commit}/${encodeURIComponent(file)}`,
      });
    }
    if (missing) {
      excluded.push({ id: f.family, reason: `no binary for ${missing} (.otf or .ttf)` });
      continue;
    }

    const rawCategory = fontsourceCategories.get(normalizeName(f.family));
    const category = rawCategory === undefined ? null : mapCategory(rawCategory);
    const categoryEvidence: CategoryEvidence[] =
      category && rawCategory !== undefined
        ? [{ category, source: "fontsource", detail: `category: "${rawCategory}"` }]
        : [];

    families.push(
      buildFamily({
        collection: "league",
        host: "github",
        repo: spec.repo,
        commit,
        repoPath: "",
        family: f.family,
        designer: f.designer,
        license: "OFL",
        licenseFile: LICENSE_FILE,
        licenseUrl: `${RAW_BASE}/${spec.repo}/${commit}/${encodeURIComponent(LICENSE_FILE)}`,
        copyright: copyrightLine(licenseText),
        categoryEvidence,
        styles,
        subsets: [],
        dateAdded,
        upstreamUrl: null,
      }),
    );
  }
  const hasBinaries = readdirSync(repoDir).some((file) => /\.(otf|ttf)$/i.test(file));
  if (!hasBinaries) excluded.push({ id: name, reason: "no built binaries" });
  return { families, excluded };
}

export function importLeague(cacheRoot: string): SourceImport {
  const pins = readPins();
  const fontsourceDir = path.join(cacheRoot, "fontsource", "font-files");
  assertPinned(fontsourceDir, pins.fontsource.commit);
  const fontsourceCategories = loadFontsourceCategories(fontsourceDir);

  const families: FontFamily[] = [];
  const excluded: { id: string; reason: string }[] = [];
  for (const spec of LEAGUE_TABLE) {
    const pin = pins.league.find((p) => p.repo === spec.repo);
    if (!pin) throw new Error(`no pin for ${spec.repo} in sources.json`);
    const repoDir = path.join(cacheRoot, spec.repo);
    assertPinned(repoDir, pin.commit);
    const r = importLeagueRepo(repoDir, spec, pin.commit, fontsourceCategories, commitDate(repoDir, pin.commit));
    families.push(...r.families);
    excluded.push(...r.excluded);
  }
  return { collection: "league", families, excluded };
}
