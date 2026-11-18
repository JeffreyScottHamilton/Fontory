// Parser for google/fonts tags/all/families.csv and the evidence-based tag -> category rules.
import type { CategoryEvidence, CategoryId } from "../../src/lib/types";

export interface TagRow { family: string; axes: string; tag: string; score: number }

export const MIN_TAG_SCORE = 50;
// /Expressive/Vintage matches ~1800 families at score 50, so retro needs a stricter score.
export const RETRO_TAG = "/Expressive/Vintage";
export const RETRO_TAG_MIN_SCORE = 80;
const DROPPED_PREFIXES = ["/Quality", "/quant", "/Fontquant", "/Skip"];

// RFC 4180-style CSV: quoted fields may contain commas, doubled quotes and newlines.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"' && field === "") { quoted = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c;
    i++;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// Rows are `family, axes (may be empty), tag, score`. A header row or any row with a
// non-numeric score is skipped; blank rows are ignored.
export function parseFamiliesCsv(text: string): TagRow[] {
  const out: TagRow[] = [];
  for (const cols of parseCsv(text)) {
    if (cols.length < 4) continue;
    const score = Number(cols[3].trim());
    if (cols[3].trim() === "" || !Number.isFinite(score)) continue;
    out.push({ family: cols[0], axes: cols[1], tag: cols[2].trim(), score });
  }
  return out;
}

// family -> tag -> best score across all axis locations.
export function familyTagRows(rows: TagRow[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const r of rows) {
    let tags = out.get(r.family);
    if (!tags) { tags = new Map(); out.set(r.family, tags); }
    tags.set(r.tag, Math.max(r.score, tags.get(r.tag) ?? -Infinity));
  }
  return out;
}

export function isDroppedTag(tag: string): boolean {
  return DROPPED_PREFIXES.some((p) => tag === p || tag.startsWith(p + "/"));
}

// Sorted human tags with score >= 50, excluding dropped prefixes.
export function keptTags(tags: Map<string, number>): string[] {
  return [...tags.entries()]
    .filter(([tag, score]) => score >= MIN_TAG_SCORE && !isDroppedTag(tag))
    .map(([tag]) => tag)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const TAG_CATEGORY: Record<string, CategoryId> = {
  "/Expressive/Vintage": "retro",
  "/Theme/Blackletter": "gothic",
  "/Theme/Pixel": "pixel",
  "/Theme/Inline": "decorative",
  "/Theme/Shaded": "decorative",
  "/Theme/Art Nouveau": "decorative",
  "/Theme/Art Deco": "decorative",
  "/Theme/Tuscan": "decorative",
  "/Theme/Woodtype": "decorative",
};

// Category evidence from tags: score >= 50 in general, >= 80 for /Expressive/Vintage (retro).
// detail: '/Theme/Pixel=100'.
export function categoriesFromTags(tags: Map<string, number>): CategoryEvidence[] {
  const out: CategoryEvidence[] = [];
  for (const tag of keptTags(tags)) {
    const category = TAG_CATEGORY[tag];
    if (!category) continue;
    const min = tag === RETRO_TAG ? RETRO_TAG_MIN_SCORE : MIN_TAG_SCORE;
    const score = tags.get(tag) ?? 0;
    if (score >= min) out.push({ category, source: "tag", detail: `${tag}=${score}` });
  }
  return out;
}
