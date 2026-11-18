// Builds data/fonts.json, data/import-report.json and the self-hosted preview sheets (public/fontface/*.css)
// from every collection: Google Fonts (google/fonts checkout), The League, Velvetyne and Fontsource.
// Usage: tsx scripts/import/build.ts [--src <dir>]   (--src overrides the google/fonts checkout)
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseMetadata, type Metadata } from "./parse-metadata";
import { categoriesFromTags, familyTagRows, keptTags, parseFamiliesCsv, RETRO_TAG, RETRO_TAG_MIN_SCORE } from "./tags";
import { familyWeights } from "./weights";
import { importFontsource, normalizeName, type SourceImport } from "./sources/fontsource";
import { importLeague } from "./sources/league";
import { importVelvetyne, vendorVelvetyne } from "./sources/velvetyne";
import { fontFormat } from "../../src/lib/preview-css";
import {
  CATEGORIES,
  type CategoryEvidence,
  type CategoryId,
  type CollectionId,
  type FontFamily,
  type FontStyle,
} from "../../src/lib/types";

const ROOT = path.resolve(__dirname, "../..");
const SOURCES_PATH = path.join(__dirname, "sources.json");
const VELVETYNE_PINS_PATH = path.join(__dirname, "sources", "velvetyne-pins.json");
const SOURCES = JSON.parse(readFileSync(SOURCES_PATH, "utf8")) as {
  googleFonts: { repo: string; commit: string };
  upstreams: { repo: string; aliases?: string[]; role?: string; note?: string }[];
};
const SHA = SOURCES.googleFonts.commit;
const RAW_BASE = `https://raw.githubusercontent.com/google/fonts/${SHA}`;
const DATA_DIR = path.join(ROOT, "data");
const VERIFY_REPORT = path.join(DATA_DIR, "verify-report.json");
const CACHE_ROOT = path.join(ROOT, ".cache", "sources");
const PUBLIC_DIR = path.join(ROOT, "public");
const FONTFACE_DIR = path.join(PUBLIC_DIR, "fontface");
const VELVETYNE_VENDOR_DIR = path.join(PUBLIC_DIR, "fonts", "velvetyne");

// Dedupe priority across collections: earlier wins on a normalized name or slug clash.
const COLLECTION_PRIORITY: CollectionId[] = ["google-fonts", "league", "velvetyne", "fontsource"];
// The verify step records this exact reason for a Google family whose css2 preview is refused.
const CSS2_UNAVAILABLE_REASON = "css2 preview HTTP 400";

const LICENSES: Record<string, { file: string; name: string }> = {
  OFL: { file: "OFL.txt", name: "SIL Open Font License 1.1" },
  APACHE2: { file: "LICENSE.txt", name: "Apache License 2.0" },
  UFL: { file: "UFL.txt", name: "Ubuntu Font Licence 1.0" },
};

const METADATA_CATEGORY: Record<string, CategoryId> = {
  SERIF: "serif",
  SANS_SERIF: "sans-serif",
  HANDWRITING: "handwriting",
  DISPLAY: "display",
  MONOSPACE: "monospace",
};

const REPORT_NOTES = [
  `Category tags: ${RETRO_TAG} maps to retro only at score >= ${RETRO_TAG_MIN_SCORE}; other category tags need score >= 50 (see tags.ts).`,
  "IBM/plex coverage also counts googlefonts/plex, the Google Fonts fork of IBM/plex (see sources.json aliases).",
  "fontsource/fontsource is a dedupe-only mirror of Google Fonts: nothing is imported from it.",
  "Variable fonts: styles are real font files; variable fonts list every standard weight within the wght axis.",
  "Preview 'fontface': the family is previewed from public/fontface/<slug>.css, built from the style files (or previewUrl woff2). Preview 'css2': Google Fonts css2 API.",
  "Google families whose css2 preview is refused (HTTP 400) are previewed with preview 'fontface' from their raw TTF files (see recovered).",
  "Dedupe across collections: normalized name (lowercase a-z0-9) and slug; priority google-fonts > league > velvetyne > fontsource.",
  "Velvetyne files are vendored unmodified under public/fonts/velvetyne/<slug>/ with the project's OFL license file.",
];

// Excluded family: id is the repo path (Google) or the importer's id (others).
export interface Excluded { collection: CollectionId; id: string; reason: string }
export interface Duplicate { collection: CollectionId; id: string; family: string; slug: string; keptCollection: CollectionId; keptId: string; reason: string }
export type LicenseCheck = { file: string; branch: string; firstLine: string } | { error: string } | null;

export function slugify(family: string): string {
  return family.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Normalises an upstream URL to lowercase "owner/repo" (tolerates www., .git, trailing slashes).
export function normalizeRepo(url: string): string {
  const cleaned = url.trim().toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .replace(/^github\.com\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
  return cleaned.split("/").slice(0, 2).join("/");
}

const sortStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// Dedupe within one collection: first candidate wins on slug or family-name collision. Pure; kept families keep input order.
export function dedupe(candidates: FontFamily[]): { kept: FontFamily[]; duplicates: { repoPath: string; family: string; slug: string; keptRepoPath: string; reason: string }[] } {
  const duplicates: { repoPath: string; family: string; slug: string; keptRepoPath: string; reason: string }[] = [];
  const bySlug = new Map<string, FontFamily>();
  const byName = new Map<string, FontFamily>();
  const kept: FontFamily[] = [];
  for (const f of candidates) {
    const clash = bySlug.get(f.slug) ?? byName.get(f.family);
    if (clash) {
      duplicates.push({
        repoPath: f.repoPath,
        family: f.family,
        slug: f.slug,
        keptRepoPath: clash.repoPath,
        reason: byName.get(f.family) ? "duplicate family name" : "slug collision",
      });
      continue;
    }
    bySlug.set(f.slug, f);
    byName.set(f.family, f);
    kept.push(f);
  }
  return { kept, duplicates };
}

// Dedupe across collections. Candidates must be in COLLECTION_PRIORITY order (the first one wins).
// A clash is an equal normalized name or an equal slug.
export function dedupeAcross(candidates: FontFamily[]): { kept: FontFamily[]; duplicates: Duplicate[] } {
  const duplicates: Duplicate[] = [];
  const bySlug = new Map<string, FontFamily>();
  const byName = new Map<string, FontFamily>();
  const kept: FontFamily[] = [];
  for (const f of candidates) {
    const nameKey = normalizeName(f.family);
    const byNameHit = byName.get(nameKey);
    const clash = byNameHit ?? bySlug.get(f.slug);
    if (clash) {
      duplicates.push({
        collection: f.collection,
        id: idOf(f),
        family: f.family,
        slug: f.slug,
        keptCollection: clash.collection,
        keptId: idOf(clash),
        reason: byNameHit ? "duplicate family name (normalized)" : "slug collision",
      });
      continue;
    }
    bySlug.set(f.slug, f);
    byName.set(nameKey, f);
    kept.push(f);
  }
  return { kept, duplicates };
}

// Stable per-family identifier for reports: the repo path for Google, else the importer's source repo.
function idOf(f: FontFamily): string {
  return f.repoPath || f.source.repo;
}

// Escapes a value for a single-quoted CSS string.
function cssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// One @font-face per style for a self-hosted (preview 'fontface') family. Pure.
export function fontfaceCss(f: Pick<FontFamily, "family" | "styles" | "axes">): string {
  const wght = f.axes.find((a) => a.tag === "wght");
  const blocks = f.styles.map((s) => {
    const src = s.previewUrl ?? s.url;
    // A variable file covers the whole wght axis, so advertise the range instead of one weight.
    const weight = wght && s.filename.includes("[") ? `${wght.min} ${wght.max}` : `${s.weight}`;
    return [
      "@font-face {",
      `  font-family: '${cssString(f.family)}';`,
      `  font-style: ${s.style};`,
      `  font-weight: ${weight};`,
      "  font-display: swap;",
      `  src: url('${cssString(src)}') format('${fontFormat(src)}');`,
      "}",
    ].join("\n");
  });
  return blocks.join("\n\n") + "\n";
}

function categoryOrder(ids: Iterable<CategoryId>): CategoryId[] {
  const set = new Set(ids);
  return CATEGORIES.map((c) => c.id).filter((id) => set.has(id));
}

// Validates one Google family directory and returns a FontFamily, or the exclusion reason.
export function buildFamily(
  repoPath: string,
  srcDir: string,
  tagRows: Map<string, Map<string, number>>,
  unmappedCategories: Set<string>,
): { family: FontFamily; droppedStyles: string[] } | { reason: string } {
  const dir = path.join(srcDir, repoPath);
  let meta: Metadata;
  try {
    meta = parseMetadata(readFileSync(path.join(dir, "METADATA.pb"), "utf8"));
  } catch (e) {
    return { reason: `METADATA parse error: ${(e as Error).message}` };
  }
  if (!meta.name) return { reason: "missing name" };
  if (!meta.designer) return { reason: "missing designer" };
  if (!meta.license) return { reason: "missing license" };
  const lic = LICENSES[meta.license];
  if (!lic) return { reason: `unsupported license ${meta.license}` };
  if (!existsSync(path.join(dir, lic.file))) return { reason: `license file ${lic.file} missing in repo dir` };
  if (!meta.dateAdded || !/^\d{4}-\d{2}-\d{2}$/.test(meta.dateAdded)) return { reason: "missing or invalid date_added" };
  if (meta.fonts.length === 0) return { reason: "no font entries" };

  // One file per style/weight: prefer a static file (no "[" axis brackets) over a variable one,
  // otherwise keep the first in METADATA order. Dropped duplicates are reported.
  const byKey = new Map<string, FontStyle>();
  const dropped: string[] = [];
  for (const f of meta.fonts) {
    if (!f.filename) return { reason: "font entry missing filename" };
    if (!/\.(ttf|otf)$/i.test(f.filename)) return { reason: `unsupported file type: ${f.filename}` };
    if (f.style !== "normal" && f.style !== "italic") return { reason: `unsupported style: ${f.style ?? "(missing)"}` };
    if (f.weight === undefined || !Number.isInteger(f.weight)) return { reason: `missing or invalid weight for ${f.filename}` };
    if (!f.fullName) return { reason: `missing full_name for ${f.filename}` };
    const style: FontStyle = {
      style: f.style,
      weight: f.weight,
      filename: f.filename,
      fullName: f.fullName,
      url: `${RAW_BASE}/${repoPath}/${encodeURIComponent(f.filename)}`,
    };
    const key = `${f.style}:${f.weight}`;
    const prev = byKey.get(key);
    if (!prev) { byKey.set(key, style); continue; }
    const prevVariable = prev.filename.includes("[");
    const nextVariable = style.filename.includes("[");
    if (prevVariable && !nextVariable) { dropped.push(prev.filename); byKey.set(key, style); }
    else dropped.push(style.filename);
  }
  const styles = [...byKey.values()];
  const copyright = meta.fonts[0].copyright;
  if (!copyright) return { reason: "missing copyright on first font" };
  styles.sort((a, b) => a.weight - b.weight || (a.style === b.style ? 0 : a.style === "normal" ? -1 : 1));

  const axes: FontFamily["axes"] = [];
  for (const a of meta.axes) {
    if (!a.tag || a.minValue === undefined || a.maxValue === undefined) return { reason: "axis missing tag/min/max" };
    axes.push({ tag: a.tag, min: a.minValue, max: a.maxValue });
  }

  const categoryEvidence: CategoryEvidence[] = [];
  for (const raw of meta.categories) {
    const id = METADATA_CATEGORY[raw];
    if (id) categoryEvidence.push({ category: id, source: "metadata", detail: `category: "${raw}"` });
    else unmappedCategories.add(raw);
  }
  const tagMap = tagRows.get(meta.name) ?? new Map<string, number>();
  categoryEvidence.push(...categoriesFromTags(tagMap));
  const categories = categoryOrder(categoryEvidence.map((e) => e.category));

  const weights = familyWeights(axes, styles);
  const srcBlock = meta.source;
  const upstream = srcBlock?.repositoryUrl
    ? { repositoryUrl: srcBlock.repositoryUrl, ...(srcBlock.commit ? { commit: srcBlock.commit } : {}) }
    : null;

  return {
    droppedStyles: dropped,
    family: {
      slug: slugify(meta.name),
      family: meta.name,
      designer: meta.designer,
      license: meta.license as FontFamily["license"],
      licenseName: lic.name,
      licenseFile: lic.file,
      licenseUrl: `${RAW_BASE}/${repoPath}/${lic.file}`,
      categories,
      categoryEvidence,
      tags: keptTags(tagMap),
      styles,
      weights,
      hasItalic: styles.some((s) => s.style === "italic"),
      axes,
      isVariable: axes.length > 0,
      subsets: meta.subsets.filter((s) => s !== "menu"),
      dateAdded: meta.dateAdded,
      repoPath,
      source: { repo: "google/fonts", commit: SHA, url: `https://github.com/google/fonts/tree/${SHA}/${repoPath}`, host: "github" },
      upstream,
      copyright,
      related: [],
      preview: "css2",
      collection: "google-fonts",
    },
  };
}

// Top 6 by shared categories*2 + Jaccard(tags)*10 (score > 0), ties by family name.
export function computeRelated(families: FontFamily[]): Map<string, string[]> {
  const tagSets = families.map((f) => new Set(f.tags));
  const out = new Map<string, string[]>();
  families.forEach((a, i) => {
    const scored: { slug: string; family: string; score: number }[] = [];
    families.forEach((b, j) => {
      if (i === j) return;
      const shared = a.categories.filter((c) => b.categories.includes(c)).length;
      let inter = 0;
      for (const t of tagSets[i]) if (tagSets[j].has(t)) inter++;
      const union = tagSets[i].size + tagSets[j].size - inter;
      const jaccard = union === 0 ? 0 : inter / union;
      const score = shared * 2 + jaccard * 10;
      if (score > 0) scored.push({ slug: b.slug, family: b.family, score });
    });
    scored.sort((x, y) => y.score - x.score || sortStr(x.family, y.family));
    out.set(a.slug, scored.slice(0, 6).map((s) => s.slug));
  });
  return out;
}

function discoverRepoPaths(srcDir: string): string[] {
  const out: string[] = [];
  for (const top of readdirSync(srcDir, { withFileTypes: true })) {
    if (!top.isDirectory() || top.name.startsWith(".") || top.name === "tags") continue;
    for (const sub of readdirSync(path.join(srcDir, top.name), { withFileTypes: true })) {
      if (sub.isDirectory() && existsSync(path.join(srcDir, top.name, sub.name, "METADATA.pb"))) {
        out.push(`${top.name}/${sub.name}`);
      }
    }
  }
  return out.sort(sortStr);
}

// Google Fonts collection: every METADATA.pb directory, validated, deduped by name and slug.
function importGoogle(srcDir: string, unmappedCategories: Set<string>): { families: FontFamily[]; excluded: Excluded[]; duplicates: Duplicate[] } {
  const tagRows = familyTagRows(parseFamiliesCsv(readFileSync(path.join(srcDir, "tags/all/families.csv"), "utf8")));
  const excluded: Excluded[] = [];
  const candidates: FontFamily[] = [];
  const styleDrops: { repoPath: string; file: string }[] = [];

  for (const repoPath of discoverRepoPaths(srcDir)) {
    const result = buildFamily(repoPath, srcDir, tagRows, unmappedCategories);
    if ("reason" in result) excluded.push({ collection: "google-fonts", id: repoPath, reason: result.reason });
    else {
      candidates.push(result.family);
      for (const file of result.droppedStyles) styleDrops.push({ repoPath, file });
    }
  }

  const duplicates: Duplicate[] = [];
  for (const d of styleDrops) {
    const f = candidates.find((c) => c.repoPath === d.repoPath)!;
    duplicates.push({
      collection: "google-fonts",
      id: d.repoPath,
      family: f.family,
      slug: f.slug,
      keptCollection: "google-fonts",
      keptId: d.repoPath,
      reason: `duplicate style/weight file dropped: ${d.file}`,
    });
  }
  const deduped = dedupe(candidates);
  for (const d of deduped.duplicates) {
    duplicates.push({
      collection: "google-fonts",
      id: d.repoPath,
      family: d.family,
      slug: d.slug,
      keptCollection: "google-fonts",
      keptId: d.keptRepoPath,
      reason: d.reason,
    });
  }
  return { families: deduped.kept, excluded, duplicates };
}

interface UpstreamLicense { repo: string; file: string | null; branch: string | null; firstLine: string | null }
interface VerifyReport {
  commit?: string;
  pins?: string;
  failedFamilies: { family: string; reason: string }[];
  css2Unavailable?: string[];
  upstreamLicenses: UpstreamLicense[];
}

// Hash of every pinned source input. A verify report only applies to the exact pins it was run against.
function pinsHash(): string {
  return createHash("sha256")
    .update(readFileSync(SOURCES_PATH))
    .update(readFileSync(VELVETYNE_PINS_PATH))
    .digest("hex");
}

function loadVerify(): VerifyReport | null {
  if (!existsSync(VERIFY_REPORT)) return null;
  const raw = JSON.parse(readFileSync(VERIFY_REPORT, "utf8")) as VerifyReport;
  if (raw.pins === pinsHash()) return raw;
  console.warn(`BUILD: WARNING ignoring ${VERIFY_REPORT}: it was verified against other pins; re-run npm run import:verify`);
  return null;
}

// Google families the css2 API refused. Recorded by verify as css2Unavailable (or, in older reports, as the sole failure reason).
function css2Unavailable(verify: VerifyReport | null): Set<string> {
  const out = new Set(verify?.css2Unavailable ?? []);
  for (const f of verify?.failedFamilies ?? []) if (f.reason === CSS2_UNAVAILABLE_REASON) out.add(f.family);
  return out;
}

function main(): void {
  const argv = process.argv.slice(2);
  const srcFlag = argv.indexOf("--src");
  const srcDir = path.resolve(srcFlag >= 0 ? argv[srcFlag + 1] : path.join(CACHE_ROOT, "google-fonts"));
  if (!existsSync(path.join(srcDir, "tags/all/families.csv"))) {
    throw new Error(`checkout not found at ${srcDir}; run npm run import:fetch first`);
  }

  const unmappedCategories = new Set<string>();
  const google = importGoogle(srcDir, unmappedCategories);

  // Verify results for this pinned state (if any). Failures are name-based across collections.
  const verify = loadVerify();
  const failed = new Map<string, string>();
  for (const f of verify?.failedFamilies ?? []) if (f.reason !== CSS2_UNAVAILABLE_REASON) failed.set(f.family, f.reason);

  // Google families refused by css2 come back as self-hosted fontface previews.
  const unavailable = css2Unavailable(verify);
  const recovered: { family: string; slug: string; reason: string }[] = [];
  for (const f of google.families) {
    if (!unavailable.has(f.family)) continue;
    f.preview = "fontface";
    recovered.push({ family: f.family, slug: f.slug, reason: CSS2_UNAVAILABLE_REASON });
  }

  const imports: SourceImport[] = [
    { collection: "google-fonts", families: google.families, excluded: google.excluded.map((e) => ({ id: e.id, reason: e.reason })) },
    importLeague(CACHE_ROOT),
    importVelvetyne(CACHE_ROOT),
    importFontsource(CACHE_ROOT),
  ];

  const excluded: Excluded[] = [];
  const duplicates: Duplicate[] = [...google.duplicates];
  const keptByCollection = new Map<CollectionId, FontFamily[]>();
  for (const imp of imports) {
    for (const e of imp.excluded) excluded.push({ collection: imp.collection, id: e.id, reason: e.reason });
    // Verify exclusions apply before cross-collection dedupe: a failing family does not block a lower-priority copy.
    const kept = imp.families.filter((f) => {
      const reason = failed.get(f.family);
      if (reason === undefined) return true;
      excluded.push({ collection: f.collection, id: idOf(f), reason: `verify: ${reason}` });
      return false;
    });
    keptByCollection.set(imp.collection, kept);
  }
  const candidates = COLLECTION_PRIORITY.flatMap((c) => keptByCollection.get(c) ?? []);
  const deduped = dedupeAcross(candidates);
  duplicates.push(...deduped.duplicates);
  const kept = deduped.kept.sort((a, b) => sortStr(a.family, b.family));

  // Velvetyne: vendor the kept families' files (unmodified) and drop vendored directories that are no longer kept.
  const velvetyne = kept.filter((f) => f.collection === "velvetyne");
  vendorVelvetyne(CACHE_ROOT, VELVETYNE_VENDOR_DIR, velvetyne);
  const velvetyneSlugs = new Set(velvetyne.map((f) => f.slug));
  mkdirSync(VELVETYNE_VENDOR_DIR, { recursive: true });
  for (const entry of readdirSync(VELVETYNE_VENDOR_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && !velvetyneSlugs.has(entry.name)) rmSync(path.join(VELVETYNE_VENDOR_DIR, entry.name), { recursive: true, force: true });
  }

  const related = computeRelated(kept);
  for (const f of kept) f.related = related.get(f.slug) ?? [];
  excluded.sort((a, b) => sortStr(a.collection, b.collection) || sortStr(a.id, b.id));
  duplicates.sort((a, b) => sortStr(a.collection, b.collection) || sortStr(a.id, b.id));

  // Upstream coverage and license checks.
  const upstreams = SOURCES.upstreams.map((u) => {
    const key = u.repo.toLowerCase();
    const keys = new Set([key, ...(u.aliases ?? []).map((a) => a.toLowerCase())]);
    const coveredBy = kept.filter((f) => f.upstream && keys.has(normalizeRepo(f.upstream.repositoryUrl))).map((f) => f.family);
    const vl = verify?.upstreamLicenses.find((l) => l.repo.toLowerCase() === key);
    let licenseCheck: LicenseCheck = null;
    if (vl) licenseCheck = vl.file && vl.branch && vl.firstLine !== null ? { file: vl.file, branch: vl.branch, firstLine: vl.firstLine } : { error: "no license file found on main or master" };
    return {
      repo: u.repo,
      ...(u.role ? { role: u.role } : {}),
      ...(u.aliases ? { aliases: u.aliases } : {}),
      ...(u.note ? { note: u.note } : {}),
      coveredBy,
      licenseCheck,
    };
  });

  const byLicense: Record<string, number> = {};
  for (const f of kept) byLicense[f.license] = (byLicense[f.license] ?? 0) + 1;
  const byCategory: Record<string, number> = {};
  for (const c of CATEGORIES) byCategory[c.id] = kept.filter((f) => f.categories.includes(c.id)).length;
  const byCollection = Object.fromEntries(
    COLLECTION_PRIORITY.map((c) => {
      const fams = kept.filter((f) => f.collection === c);
      return [c, { families: fams.length, styles: fams.reduce((a, f) => a + f.styles.length, 0), fontface: fams.filter((f) => f.preview === "fontface").length }];
    }),
  );
  const totalStyles = kept.reduce((a, f) => a + f.styles.length, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    commit: SHA,
    totals: {
      families: kept.length,
      styles: totalStyles,
      byCollection,
      byLicense,
      byCategory,
    },
    recovered,
    excluded,
    duplicates,
    upstreams,
    notes: REPORT_NOTES,
  };

  // Output: data files and the self-hosted preview sheets (stale sheets removed).
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(path.join(DATA_DIR, "fonts.json"), JSON.stringify(kept) + "\n");
  writeFileSync(path.join(DATA_DIR, "import-report.json"), JSON.stringify(report, null, 2) + "\n");

  mkdirSync(FONTFACE_DIR, { recursive: true });
  const fontface = kept.filter((f) => f.preview === "fontface");
  const wanted = new Set(fontface.map((f) => `${f.slug}.css`));
  for (const f of fontface) writeFileSync(path.join(FONTFACE_DIR, `${f.slug}.css`), fontfaceCss(f));
  for (const name of readdirSync(FONTFACE_DIR)) {
    if (name.endsWith(".css") && !wanted.has(name)) unlinkSync(path.join(FONTFACE_DIR, name));
  }

  console.log(`BUILD: families=${kept.length} styles=${totalStyles} excluded=${excluded.length} duplicates=${duplicates.length} recovered=${recovered.length} fontface=${fontface.length} verifyApplied=${verify !== null}`);
  for (const c of COLLECTION_PRIORITY) console.log(`BUILD: ${c} families=${byCollection[c].families} styles=${byCollection[c].styles}`);
  if (unmappedCategories.size) console.log(`BUILD: unmapped METADATA categories ignored: ${[...unmappedCategories].join(", ")}`);
}

if (require.main === module) main();
