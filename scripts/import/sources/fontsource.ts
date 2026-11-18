// Imports fontsource/font-files fonts/other/<id> (woff2 only, web-licensed) from the pinned sparse clone.
// Reads .cache/sources/fontsource/font-files (see scripts/import/fetch-extra.sh). Sync, no network.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { CategoryEvidence, CategoryId, CollectionId, FontFamily, FontStyle, LicenseId } from "../../../src/lib/types";

export interface SourceImport {
  collection: CollectionId;
  families: FontFamily[];
  excluded: { id: string; reason: string }[];
}

const REPO = "fontsource/font-files";
const RAW_BASE = "https://raw.githubusercontent.com";
const SOURCES_JSON = path.join(__dirname, "..", "sources.json");

// metadata.json license.type (lowercased) -> contract license id.
const LICENSE_BY_TYPE: Record<string, LicenseId> = {
  "ofl-1.1": "OFL",
  "apache-2.0": "APACHE2",
  mit: "MIT",
  "cc0-1.0": "CC0",
  unlicense: "UNLICENSE",
};

export const LICENSE_NAMES: Record<LicenseId, string> = {
  OFL: "SIL Open Font License 1.1",
  APACHE2: "Apache License 2.0",
  UFL: "Ubuntu Font Licence 1.0",
  MIT: "MIT License",
  CC0: "CC0 1.0 Universal",
  UNLICENSE: "The Unlicense",
};

const CATEGORY_BY_NAME: Record<string, CategoryId> = {
  serif: "serif",
  "sans-serif": "sans-serif",
  display: "display",
  handwriting: "handwriting",
  monospace: "monospace",
};

const WEIGHT_NAMES: Record<number, string> = {
  100: "Thin",
  200: "ExtraLight",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
  800: "ExtraBold",
  900: "Black",
};

// Same logic as scripts/import/build.ts slugify (copied: build.ts is a script with a main entry).
export function slugify(family: string): string {
  return family.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Maps a raw category value to a CategoryId; unknown values (e.g. fontsource "other") map to null.
export function mapCategory(raw: unknown): CategoryId | null {
  if (typeof raw !== "string") return null;
  return CATEGORY_BY_NAME[raw.trim().toLowerCase()] ?? null;
}

// Normalized family name used for cross-source matching: lowercase, a-z0-9 only.
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Reads the pins from scripts/import/sources.json.
export function readPins(): { fontsource: { commit: string }; league: { repo: string; commit: string }[] } {
  return JSON.parse(readFileSync(SOURCES_JSON, "utf8"));
}

function git(repoDir: string, args: string[]): string {
  return execFileSync("git", ["-C", repoDir, ...args], { encoding: "utf8" }).trim();
}

// Throws unless the clone is checked out at the pinned commit (run scripts/import/fetch-extra.sh).
export function assertPinned(repoDir: string, commit: string): void {
  if (!existsSync(path.join(repoDir, ".git"))) {
    throw new Error(`missing clone ${repoDir} (run scripts/import/fetch-extra.sh)`);
  }
  const head = git(repoDir, ["rev-parse", "HEAD"]);
  if (head !== commit) throw new Error(`clone ${repoDir} is at ${head}, pinned ${commit}`);
}

// Source commit date (YYYY-MM-DD) of the pinned commit, read from the local clone.
export function commitDate(repoDir: string, commit: string): string {
  return git(repoDir, ["log", "-1", "--format=%cs", commit]);
}

export function copyrightLine(licenseText: string): string {
  const line = licenseText.split(/\r?\n/).find((l) => /copyright/i.test(l));
  return line ? line.trim() : "";
}

export function sortStyles(styles: FontStyle[]): FontStyle[] {
  return [...styles].sort((a, b) => a.weight - b.weight || (a.style === b.style ? 0 : a.style === "normal" ? -1 : 1));
}

export interface FamilyInput {
  collection: CollectionId;
  host: "github";
  repo: string; // e.g. 'fontsource/font-files'
  commit: string;
  repoPath: string; // directory inside the repo, '' for root
  family: string;
  designer: string;
  license: LicenseId;
  licenseFile: string;
  licenseUrl: string;
  copyright: string;
  categoryEvidence: CategoryEvidence[];
  styles: FontStyle[];
  subsets: string[];
  dateAdded: string;
  upstreamUrl: string | null;
}

// Assembles a FontFamily for a non-Google source (no tags, no axes, related computed by build).
export function buildFamily(input: FamilyInput): FontFamily {
  const styles = sortStyles(input.styles);
  const weights = [...new Set(styles.map((s) => s.weight))].sort((a, b) => a - b);
  const categories = [...new Set(input.categoryEvidence.map((e) => e.category))];
  const dir = input.repoPath ? `/${input.repoPath}` : "";
  return {
    slug: slugify(input.family),
    family: input.family,
    designer: input.designer,
    license: input.license,
    licenseName: LICENSE_NAMES[input.license],
    licenseFile: input.licenseFile,
    licenseUrl: input.licenseUrl,
    categories,
    categoryEvidence: input.categoryEvidence,
    tags: [],
    styles,
    weights,
    hasItalic: styles.some((s) => s.style === "italic"),
    axes: [],
    isVariable: false,
    subsets: input.subsets,
    dateAdded: input.dateAdded,
    repoPath: input.repoPath,
    source: {
      repo: input.repo,
      commit: input.commit,
      url: `https://github.com/${input.repo}/tree/${input.commit}${dir}`,
      host: input.host,
    },
    upstream: input.upstreamUrl ? { repositoryUrl: input.upstreamUrl } : null,
    copyright: input.copyright,
    related: [],
    preview: "fontface",
    collection: input.collection,
  };
}

export function fullStyleName(family: string, weight: number, style: "normal" | "italic"): string {
  return `${family} ${WEIGHT_NAMES[weight] ?? String(weight)}${style === "italic" ? " Italic" : ""}`;
}

type One = { family: FontFamily } | { reason: string };

// Resolves one (weight, style) to a single woff2: prefer latin, else the only subset, else exclude.
function pickFile(id: string, filesDir: string, weight: number, style: string): { file: string } | { reason: string } {
  const suffix = `-${weight}-${style}.woff2`;
  const available = existsSync(filesDir) ? readdirSync(filesDir) : [];
  const subsets = available
    .filter((f) => f.startsWith(`${id}-`) && f.endsWith(suffix))
    .map((f) => ({ file: f, subset: f.slice(id.length + 1, f.length - suffix.length) }))
    .filter((x) => x.subset.length > 0);
  if (subsets.length === 0) return { reason: `no woff2 for ${weight} ${style}` };
  const latin = subsets.find((x) => x.subset === "latin");
  if (latin) return { file: latin.file };
  if (subsets.length === 1) return { file: subsets[0].file };
  return { reason: `${weight} ${style}: split into ${subsets.length} unicode-range subsets` };
}

function importOne(otherDir: string, id: string, commit: string, dateAdded: string): One {
  const dir = path.join(otherDir, id);
  const metaPath = path.join(dir, "metadata.json");
  if (!existsSync(metaPath)) return { reason: "no metadata.json" };
  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Record<string, unknown>;

  const licenseRaw = typeof meta.license === "object" && meta.license !== null ? (meta.license as { type?: unknown }).type : meta.license;
  const license = typeof licenseRaw === "string" ? LICENSE_BY_TYPE[licenseRaw.trim().toLowerCase()] : undefined;
  if (!license) return { reason: `license ${JSON.stringify(licenseRaw ?? null)} not allowed` };

  const licensePath = path.join(dir, "LICENSE");
  if (!existsSync(licensePath)) return { reason: "no LICENSE file" };
  const licenseText = readFileSync(licensePath, "utf8");
  if (/reserved font name/i.test(licenseText)) return { reason: 'LICENSE contains "Reserved Font Name"' };

  const family = typeof meta.family === "string" ? meta.family : id;
  const weights = Array.isArray(meta.weights) ? (meta.weights as number[]) : [];
  const styleNames = Array.isArray(meta.styles) ? (meta.styles as string[]) : [];
  const filesDir = path.join(dir, "files");

  const styles: FontStyle[] = [];
  for (const weight of weights) {
    for (const style of styleNames) {
      if (style !== "normal" && style !== "italic") return { reason: `unsupported style ${style}` };
      const picked = pickFile(id, filesDir, weight, style);
      if ("reason" in picked) return { reason: picked.reason };
      styles.push({
        style,
        weight,
        filename: picked.file,
        fullName: fullStyleName(family, weight, style),
        url: `${RAW_BASE}/${REPO}/${commit}/fonts/other/${id}/files/${picked.file}`,
      });
    }
  }
  if (styles.length === 0) return { reason: "no weight/style files" };

  const rawCategory = meta.category;
  const category = mapCategory(rawCategory);
  const categoryEvidence: CategoryEvidence[] =
    category && typeof rawCategory === "string"
      ? [{ category, source: "fontsource", detail: `category: "${rawCategory}"` }]
      : [];

  const designer =
    typeof meta.designer === "string"
      ? meta.designer
      : Array.isArray(meta.authors)
        ? (meta.authors as unknown[]).filter((a): a is string => typeof a === "string").join(", ")
        : "";

  const licenseRel = `fonts/other/${id}/LICENSE`;
  return {
    family: buildFamily({
      collection: "fontsource",
      host: "github",
      repo: REPO,
      commit,
      repoPath: `fonts/other/${id}`,
      family,
      designer,
      license,
      licenseFile: "LICENSE",
      licenseUrl: `${RAW_BASE}/${REPO}/${commit}/${licenseRel}`,
      copyright: copyrightLine(licenseText),
      categoryEvidence,
      styles,
      subsets: Array.isArray(meta.subsets) ? (meta.subsets as string[]).filter((s) => s !== "menu") : [],
      dateAdded,
      upstreamUrl: typeof meta.source === "string" ? meta.source : null,
    }),
  };
}

// Imports from an explicit clone directory (fonts/other lives under it). Used by importFontsource and tests.
export function importFontsourceFrom(repoDir: string, commit: string, dateAdded: string): SourceImport {
  const otherDir = path.join(repoDir, "fonts", "other");
  const ids = readdirSync(otherDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const families: FontFamily[] = [];
  const excluded: { id: string; reason: string }[] = [];
  for (const id of ids) {
    const result = importOne(otherDir, id, commit, dateAdded);
    if ("reason" in result) excluded.push({ id, reason: result.reason });
    else families.push(result.family);
  }
  return { collection: "fontsource", families, excluded };
}

export function importFontsource(cacheRoot: string): SourceImport {
  const repoDir = path.join(cacheRoot, "fontsource", "font-files");
  const commit = readPins().fontsource.commit;
  assertPinned(repoDir, commit);
  return importFontsourceFrom(repoDir, commit, commitDate(repoDir, commit));
}
