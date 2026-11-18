import type { CategoryId, FontIndexEntry } from "@/lib/types";

export type SortKey = "az" | "newest" | "styles";

export interface FilterOptions {
  q?: string;
  categories?: CategoryId[];
  italic?: boolean;
  variable?: boolean;
  sort?: SortKey;
}

// Relevance tiers (lower is better). Only used when the query is non-empty.
const EXACT = 0;
const PREFIX = 1;
const CONTAINS = 2;
const DESIGNER = 3;

function sortCompare(sort: SortKey) {
  return (a: FontIndexEntry, b: FontIndexEntry): number => {
    if (sort === "newest") {
      if (a.dateAdded !== b.dateAdded) return a.dateAdded < b.dateAdded ? 1 : -1;
    } else if (sort === "styles") {
      if (a.styleCount !== b.styleCount) return b.styleCount - a.styleCount;
    }
    return familyCompare(a, b);
  };
}

function familyCompare(a: FontIndexEntry, b: FontIndexEntry): number {
  const byName = a.family.localeCompare(b.family, "en");
  if (byName !== 0) return byName;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

/**
 * Returns the tier for an entry that already matched every query token,
 * or -1 if it did not match. The query is the trimmed, lowercased string;
 * tokens are its whitespace-separated parts.
 */
function relevanceTier(entry: FontIndexEntry, query: string, tokens: string[]): number {
  const family = entry.family.toLowerCase();
  if (family === query) return EXACT;
  if (family.startsWith(query)) return PREFIX;
  if (tokens.every((t) => family.includes(t))) return CONTAINS;
  const designer = entry.designer.toLowerCase();
  if (tokens.every((t) => family.includes(t) || designer.includes(t))) return DESIGNER;
  return -1;
}

export function filterFonts(index: FontIndexEntry[], opts: FilterOptions = {}): FontIndexEntry[] {
  const query = (opts.q ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const tokens = query ? query.split(" ") : [];
  const categories = opts.categories ?? [];
  const sort: SortKey = opts.sort ?? "az";
  const byKey = sortCompare(sort);

  const matched: { entry: FontIndexEntry; tier: number }[] = [];
  for (const entry of index) {
    if (categories.length > 0 && !entry.categories.some((c) => categories.includes(c))) continue;
    if (opts.italic && !entry.hasItalic) continue;
    if (opts.variable && !entry.isVariable) continue;

    let tier = 0;
    if (tokens.length > 0) {
      tier = relevanceTier(entry, query, tokens);
      if (tier < 0) continue;
    }
    matched.push({ entry, tier });
  }

  matched.sort((a, b) => a.tier - b.tier || byKey(a.entry, b.entry));
  return matched.map((m) => m.entry);
}
