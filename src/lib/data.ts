import fs from "node:fs";
import path from "node:path";
import type { FontFamily, FontIndexEntry, FontStyle } from "@/lib/types";

// Server-side loader for data/fonts.json. Memoized per process.
// Not importing 'server-only' because the package is not installed.

const DATA_PATH = path.join(process.cwd(), "data", "fonts.json");

let families: FontFamily[] | undefined;
let bySlug: Map<string, FontFamily> | undefined;
let index: FontIndexEntry[] | undefined;

/**
 * previewWeight: 400 if a normal face exists, else the normal weight closest
 * to 400 (ties go to the lower weight), else the closest italic weight.
 */
export function previewFor(styles: FontStyle[]): { previewWeight: number; previewStyle: "normal" | "italic" } {
  const closest = (list: FontStyle[]): number | undefined => {
    let best: number | undefined;
    for (const s of list) {
      if (best === undefined) {
        best = s.weight;
        continue;
      }
      const d = Math.abs(s.weight - 400);
      const bd = Math.abs(best - 400);
      if (d < bd || (d === bd && s.weight < best)) best = s.weight;
    }
    return best;
  };
  const normals = styles.filter((s) => s.style === "normal");
  if (normals.some((s) => s.weight === 400)) return { previewWeight: 400, previewStyle: "normal" };
  const normalWeight = closest(normals);
  if (normalWeight !== undefined) return { previewWeight: normalWeight, previewStyle: "normal" };
  const italics = styles.filter((s) => s.style === "italic");
  return { previewWeight: closest(italics) ?? 400, previewStyle: "italic" };
}

/** Derives the list-view shape (same as public/data/index.json) from a full family record. */
export function toIndexEntry(f: FontFamily): FontIndexEntry {
  const { previewWeight, previewStyle } = previewFor(f.styles);
  return {
    slug: f.slug,
    family: f.family,
    designer: f.designer,
    categories: f.categories,
    weights: f.weights,
    hasItalic: f.hasItalic,
    isVariable: f.isVariable,
    styleCount: f.styles.length,
    dateAdded: f.dateAdded,
    previewWeight,
    previewStyle,
    preview: f.preview,
    collection: f.collection,
  };
}

/**
 * Fills fields that older data/fonts.json records lack, so the site works before and after
 * a re-import: preview 'css2', collection 'google-fonts', source.host 'github'.
 */
export function normalizeFamily(f: FontFamily): FontFamily {
  return {
    ...f,
    preview: f.preview ?? "css2",
    collection: f.collection ?? "google-fonts",
    source: { ...f.source, host: f.source?.host ?? "github" },
  };
}

function load(): FontFamily[] {
  if (!families) {
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf8")) as FontFamily[];
    families = raw.map(normalizeFamily);
  }
  return families;
}

function slugMap(): Map<string, FontFamily> {
  if (!bySlug) {
    bySlug = new Map(load().map((f) => [f.slug, f]));
  }
  return bySlug;
}

export function getAllFamilies(): FontFamily[] {
  return load();
}

export function getFamily(slug: string): FontFamily | undefined {
  return slugMap().get(slug);
}

export function getIndex(): FontIndexEntry[] {
  if (!index) {
    index = load().map(toIndexEntry);
  }
  return index;
}

/** Returns the families for the given slugs, in input order. Unknown slugs are skipped. */
export function getFamiliesBySlugs(slugs: string[]): FontFamily[] {
  const map = slugMap();
  const out: FontFamily[] = [];
  for (const slug of slugs) {
    const f = map.get(slug);
    if (f) out.push(f);
  }
  return out;
}
