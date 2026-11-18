// Builds data/fonts.json, public/data/index.json and data/import-report.json from the
// google/fonts checkout. Usage: tsx scripts/import/build.ts [--src <dir>]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseMetadata, type Metadata } from "./parse-metadata";
import { categoriesFromTags, familyTagRows, keptTags, parseFamiliesCsv, RETRO_TAG, RETRO_TAG_MIN_SCORE } from "./tags";
import { familyWeights, previewFor, styleCountFor } from "./weights";
import { CATEGORIES, type CategoryEvidence, type CategoryId, type FontFamily, type FontIndexEntry, type FontStyle } from "../../src/lib/types";

const ROOT = path.resolve(__dirname, "../..");
const SOURCES = JSON.parse(readFileSync(path.join(__dirname, "sources.json"), "utf8")) as {
  googleFonts: { repo: string; commit: string };
  upstreams: { repo: string; aliases?: string[]; role?: string; note?: string }[];
};
const SHA = SOURCES.googleFonts.commit;
const RAW_BASE = `https://raw.githubusercontent.com/google/fonts/${SHA}`;
const DATA_DIR = path.join(ROOT, "data");
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "data");
const VERIFY_REPORT = path.join(DATA_DIR, "verify-report.json");

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
  "Variable fonts: weights span every standard weight inside the wght axis; styles remain the real files; styleCount = weights x (normal+italic).",
];

export interface Excluded { repoPath: string; reason: string }
export interface Duplicate { repoPath: string; family: string; slug: string; keptRepoPath: string; reason: string }
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

function categoryOrder(ids: Iterable<CategoryId>): CategoryId[] {
  const set = new Set(ids);
  return CATEGORIES.map((c) => c.id).filter((id) => set.has(id));
}

// Validates one family directory and returns a FontFamily, or the exclusion reason.
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
      source: { repo: "google/fonts", commit: SHA, url: `https://github.com/google/fonts/tree/${SHA}/${repoPath}` },
      upstream,
      copyright,
      related: [],
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

function readJsonIfExists<T>(file: string): T | null {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null;
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

function main(): void {
  const argv = process.argv.slice(2);
  const srcFlag = argv.indexOf("--src");
  const srcDir = path.resolve(srcFlag >= 0 ? argv[srcFlag + 1] : path.join(ROOT, ".cache/sources/google-fonts"));
  if (!existsSync(path.join(srcDir, "tags/all/families.csv"))) {
    throw new Error(`checkout not found at ${srcDir}; run npm run import:fetch first`);
  }

  const tagRows = familyTagRows(parseFamiliesCsv(readFileSync(path.join(srcDir, "tags/all/families.csv"), "utf8")));
  const unmappedCategories = new Set<string>();
  const excluded: Excluded[] = [];
  const candidates: FontFamily[] = [];
  const styleDrops: { repoPath: string; file: string }[] = [];

  for (const repoPath of discoverRepoPaths(srcDir)) {
    const result = buildFamily(repoPath, srcDir, tagRows, unmappedCategories);
    if ("reason" in result) excluded.push({ repoPath, reason: result.reason });
    else {
      candidates.push(result.family);
      for (const file of result.droppedStyles) styleDrops.push({ repoPath, file });
    }
  }

  const duplicates: Duplicate[] = [];
  // Dedupe: first by repoPath wins on slug or family-name collision.
  for (const d of styleDrops) {
    const f = candidates.find((c) => c.repoPath === d.repoPath)!;
    duplicates.push({ repoPath: d.repoPath, family: f.family, slug: f.slug, keptRepoPath: d.repoPath, reason: `duplicate style/weight file dropped: ${d.file}` });
  }
  const bySlug = new Map<string, FontFamily>();
  const byName = new Map<string, FontFamily>();
  let kept: FontFamily[] = [];
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

  // Verify exclusions (from a previous `import:verify` run).
  const verify = readJsonIfExists<{ failedFamilies: { family: string; reason: string }[]; upstreamLicenses: UpstreamLicense[] }>(VERIFY_REPORT);
  if (verify) {
    const failed = new Map(verify.failedFamilies.map((f) => [f.family, f.reason]));
    kept = kept.filter((f) => {
      const reason = failed.get(f.family);
      if (reason === undefined) return true;
      excluded.push({ repoPath: f.repoPath, reason: `verify: ${reason}` });
      return false;
    });
  }

  kept.sort((a, b) => sortStr(a.family, b.family));
  const related = computeRelated(kept);
  for (const f of kept) f.related = related.get(f.slug) ?? [];
  excluded.sort((a, b) => sortStr(a.repoPath, b.repoPath));
  duplicates.sort((a, b) => sortStr(a.repoPath, b.repoPath));

  const index: FontIndexEntry[] = kept.map((f) => {
    const preview = previewFor(f);
    return {
      slug: f.slug,
      family: f.family,
      designer: f.designer,
      categories: f.categories,
      weights: f.weights,
      hasItalic: f.hasItalic,
      isVariable: f.isVariable,
      styleCount: styleCountFor(f),
      dateAdded: f.dateAdded,
      previewWeight: preview.previewWeight,
      previewStyle: preview.previewStyle,
    };
  });

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

  const report = {
    generatedAt: new Date().toISOString(),
    commit: SHA,
    totals: {
      families: kept.length,
      styles: kept.reduce((a, f) => a + f.styles.length, 0),
      byLicense,
      byCategory,
    },
    excluded,
    duplicates,
    upstreams,
    notes: REPORT_NOTES,
  };

  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
  writeFileSync(path.join(DATA_DIR, "fonts.json"), JSON.stringify(kept) + "\n");
  writeFileSync(path.join(PUBLIC_DATA_DIR, "index.json"), JSON.stringify(index) + "\n");
  writeFileSync(path.join(DATA_DIR, "import-report.json"), JSON.stringify(report, null, 2) + "\n");

  console.log(`BUILD: families=${kept.length} styles=${report.totals.styles} excluded=${excluded.length} duplicates=${duplicates.length} verifyApplied=${verify !== null}`);
  if (unmappedCategories.size) console.log(`BUILD: unmapped METADATA categories ignored: ${[...unmappedCategories].join(", ")}`);
}

interface UpstreamLicense { repo: string; file: string | null; branch: string | null; firstLine: string | null }

if (require.main === module) main();
