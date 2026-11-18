// Pure helpers that pick how a family is previewed in the browser. No node imports.
import { cssUrl, type CssStyle } from "./google-css";
import type { FontFamily, PreviewMode } from "./types";

/**
 * Stylesheet href for a family's preview. 'css2' families use the Google Fonts css2 URL
 * for the given styles; 'fontface' families use the self-hosted sheet that build emits,
 * which already carries every style (so the styles argument is not needed there).
 */
export function previewHref(
  f: { slug: string; family: string; preview: PreviewMode },
  styles: CssStyle[],
): string {
  if (f.preview === "fontface") return `/fontface/${f.slug}.css`;
  return cssUrl(f.family, styles);
}

export interface SnippetBlock {
  label: string;
  code: string;
}

/** Output format for a style's file, from its extension. Unknown extensions fall back to truetype. */
export function fontFormat(filename: string): "woff2" | "woff" | "opentype" | "truetype" {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "woff2") return "woff2";
  if (ext === "woff") return "woff";
  if (ext === "otf") return "opentype";
  return "truetype";
}

/** Human file format label for a style's file: "OTF", "TTF", "WOFF2", "WOFF". */
export function fileFormatLabel(filename: string): string {
  const labels = { opentype: "OTF", truetype: "TTF", woff2: "WOFF2", woff: "WOFF" } as const;
  return labels[fontFormat(filename)];
}

/**
 * Self-hosting @font-face CSS: one block per style, pointing at the downloaded file names,
 * then the font-family line. The files must sit next to the CSS file.
 */
export function selfHostedFontFace(f: Pick<FontFamily, "family" | "styles" | "categories">): string {
  const faces = f.styles.map(
    (s) =>
      [
        "@font-face {",
        `  font-family: '${f.family}';`,
        `  font-style: ${s.style};`,
        `  font-weight: ${s.weight};`,
        "  font-display: swap;",
        `  src: url('${s.filename}') format('${fontFormat(s.filename)}');`,
        "}",
      ].join("\n"),
  );
  return faces.join("\n\n");
}

/**
 * Copy-paste snippets for the detail page. css2 families keep the Google link, @import and
 * font-family lines. fontface families get one self-hosting @font-face block instead.
 */
export function webSnippetBlocks(
  f: Pick<FontFamily, "family" | "styles" | "categories" | "preview">,
  links: { linkTag: string; importLine: string; fontFamilyLine: string },
): SnippetBlock[] {
  const { fontFamilyLine } = links;
  if (f.preview === "fontface") {
    return [
      {
        label: "CSS @font-face (self-host the downloaded files)",
        code: `${selfHostedFontFace(f)}\n\n${fontFamilyLine}`,
      },
    ];
  }
  return [
    { label: "HTML link", code: links.linkTag },
    { label: "CSS import", code: links.importLine },
    { label: "CSS font-family", code: fontFamilyLine },
  ];
}

