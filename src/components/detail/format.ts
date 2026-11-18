// Pure helpers for the font detail page. Safe to import from server and client code.
import { CATEGORIES, type CategoryEvidence, type CategoryId, type FontFamily, type FontStyle } from "@/lib/types";

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

const CATEGORY_LABEL = new Map<CategoryId, string>(CATEGORIES.map((c) => [c.id, c.label]));

/** "Bold 700", or just "350" when the weight has no standard name. */
export function weightLabel(weight: number): string {
  const name = WEIGHT_NAMES[weight];
  return name ? `${name} ${weight}` : String(weight);
}

/** Mono tag for a weight: "700 BOLD", "350". */
export function weightTag(weight: number): string {
  const name = WEIGHT_NAMES[weight];
  return name ? `${weight} ${name.toUpperCase()}` : String(weight);
}

/** Mono tag for a style row: "700 BOLD ITALIC", "400 REGULAR". */
export function styleTag(style: FontStyle): string {
  return `${weightTag(style.weight)}${style.style === "italic" ? " ITALIC" : ""}`;
}

/** "VARIABLE · WGHT 100–900" for a wght axis, otherwise null. */
export function variableWeightLabel(axes: FontFamily["axes"]): string | null {
  const wght = axes.find((a) => a.tag === "wght");
  return wght ? `VARIABLE · WGHT ${wght.min}–${wght.max}` : null;
}

/** "U+0041" for the first code point of a glyph. */
export function codePointLabel(glyph: string): string {
  const cp = glyph.codePointAt(0) ?? 0;
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** "Regular 400", "Regular 400 Italic". */
export function styleLabel(style: FontStyle): string {
  return `${weightLabel(style.weight)}${style.style === "italic" ? " Italic" : ""}`;
}

/** Weights as available: a continuous range for a wght axis, otherwise the listed weights. */
export function weightsText(f: Pick<FontFamily, "axes" | "weights">): string {
  const wght = f.axes.find((a) => a.tag === "wght");
  if (wght) return `${weightLabel(wght.min)} – ${weightLabel(wght.max)} (variable)`;
  return f.weights.map(weightLabel).join(", ");
}

/** "opsz 14–32, wght 100–900", or "" when the family is static. */
export function axesText(axes: FontFamily["axes"]): string {
  return axes.map((a) => `${a.tag} ${a.min}–${a.max}`).join(", ");
}

export function categoryLabel(id: CategoryId): string {
  return CATEGORY_LABEL.get(id) ?? id;
}

/** Human sentence for one evidence record, e.g. "Google Fonts tag /Theme/Pixel (score 100)". */
export function evidenceText(e: CategoryEvidence): string {
  if (e.source === "tag") {
    const m = /^(.*)=(\d+)$/.exec(e.detail);
    if (m) return `Google Fonts tag ${m[1]} (score ${m[2]})`;
    return `Google Fonts tag ${e.detail}`;
  }
  if (e.source === "fontsource") return `Fontsource metadata ${e.detail}`;
  const m = /^category:\s*"?([A-Z_]+)"?$/.exec(e.detail);
  if (m) return `METADATA category ${m[1]}`;
  return `METADATA ${e.detail}`;
}

export interface GlyphRow {
  id: string;
  label: string;
  glyphs: string[];
}

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const NUMERALS = "0123456789";
const PUNCTUATION = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~ ¡¿«»€£¥©®°±×÷";
const LATIN_EXT = "ÀÁÂÃÄÅĀĂĄÇĆČĎĐÈÉÊËĒĘĚĞĢÌÍÎÏĪĮİĶĹĻĽŁÑŃŅŇÒÓÔÕÖŌŐŒŔŘŚŞŠŢŤÙÚÛÜŪŮŰŲÝŸŹŻŽ";
const CYRILLIC = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
const GREEK = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ";

function glyphs(s: string): string[] {
  return Array.from(s).filter((c) => c.trim() !== "");
}

/** Character set rows; extended scripts appear only when the family ships that subset. */
export function glyphRows(subsets: string[]): GlyphRow[] {
  const rows: GlyphRow[] = [
    { id: "upper", label: "Uppercase A–Z", glyphs: glyphs(UPPER) },
    { id: "lower", label: "Lowercase a–z", glyphs: glyphs(LOWER) },
    { id: "numerals", label: "Numerals 0–9", glyphs: glyphs(NUMERALS) },
    { id: "punctuation", label: "Punctuation & symbols", glyphs: glyphs(PUNCTUATION) },
  ];
  if (subsets.includes("latin-ext")) rows.push({ id: "latin-ext", label: "Latin extended", glyphs: glyphs(LATIN_EXT) });
  if (subsets.includes("cyrillic")) rows.push({ id: "cyrillic", label: "Cyrillic", glyphs: glyphs(CYRILLIC) });
  if (subsets.includes("greek")) rows.push({ id: "greek", label: "Greek", glyphs: glyphs(GREEK) });
  return rows;
}
