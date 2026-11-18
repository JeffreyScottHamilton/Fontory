// Weight and preview rules shared by build.ts and verify-remote.ts (pure, no side effects).
import type { FontAxis, FontStyle } from "../../src/lib/types";

export const STANDARD_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

// Family weights: real file weights, plus every standard weight inside a wght axis range.
// Styles stay as the real files; this only widens the advertised weights for variable fonts.
export function familyWeights(axes: Pick<FontAxis, "tag" | "min" | "max">[], styles: Pick<FontStyle, "weight">[]): number[] {
  const set = new Set(styles.map((s) => s.weight));
  const wght = axes.find((a) => a.tag === "wght");
  if (wght) for (const w of STANDARD_WEIGHTS) if (w >= wght.min && w <= wght.max) set.add(w);
  return [...set].sort((a, b) => a - b);
}

// Preferred preview: weight 400 if in range, else the closest weight (ties lighter).
// Style: normal if a normal file exists, else italic.
export function previewFor(f: { styles: Pick<FontStyle, "style">[]; weights: number[] }): {
  previewWeight: number;
  previewStyle: "normal" | "italic";
} {
  const previewStyle = f.styles.some((s) => s.style === "normal") ? "normal" : "italic";
  const previewWeight = f.weights.includes(400)
    ? 400
    : [...f.weights].sort((a, b) => Math.abs(a - 400) - Math.abs(b - 400) || a - b)[0];
  return { previewWeight, previewStyle };
}
