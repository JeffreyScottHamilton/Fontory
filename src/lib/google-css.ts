// Pure helpers for Google Fonts css2 URLs and copy-paste snippets. No node imports.
import type { FontFamily } from "./types";

export interface CssStyle { weight: number; style: "normal" | "italic" }

const GENERIC_ORDER: [string, string][] = [
  ["monospace", "monospace"],
  ["serif", "serif"],
  ["handwriting", "cursive"],
];

export function cssUrl(family: string, styles: CssStyle[], opts?: { text?: string }): string {
  const name = encodeURIComponent(family).replace(/%20/g, "+");
  const hasItalic = styles.some((s) => s.style === "italic");
  const tuples = new Map<string, { ital: number; weight: number }>();
  for (const s of styles) {
    const ital = s.style === "italic" ? 1 : 0;
    tuples.set(`${ital},${s.weight}`, { ital, weight: s.weight });
  }
  const sorted = [...tuples.values()].sort((a, b) => a.ital - b.ital || a.weight - b.weight);
  let axis = "";
  if (sorted.length > 0) {
    axis = hasItalic
      ? `:ital,wght@${sorted.map((t) => `${t.ital},${t.weight}`).join(";")}`
      : `:wght@${sorted.map((t) => t.weight).join(";")}`;
  }
  let url = `https://fonts.googleapis.com/css2?family=${name}${axis}&display=swap`;
  if (opts?.text) url += `&text=${encodeURIComponent(opts.text)}`;
  return url;
}

export function genericFamily(categories: readonly string[]): string {
  for (const [cat, generic] of GENERIC_ORDER) if (categories.includes(cat)) return generic;
  return "sans-serif";
}

export function cssSnippet(
  f: Pick<FontFamily, "family" | "styles" | "categories">,
): { linkTag: string; importLine: string; fontFamilyLine: string } {
  const url = cssUrl(f.family, f.styles);
  return {
    linkTag: `<link rel="stylesheet" href="${url}">`,
    importLine: `@import url('${url}');`,
    fontFamilyLine: `font-family: '${f.family}', ${genericFamily(f.categories)};`,
  };
}
