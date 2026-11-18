import { describe, expect, it } from "vitest";
import { cssUrl } from "./google-css";
import { fileFormatLabel, fontFormat, previewHref, selfHostedFontFace, webSnippetBlocks } from "./preview-css";
import type { FontStyle } from "./types";

const n = (weight: number): { weight: number; style: "normal" } => ({ weight, style: "normal" });

describe("previewHref", () => {
  it("returns the css2 URL for css2 families", () => {
    const href = previewHref({ slug: "inter", family: "Inter", preview: "css2" }, [n(400), n(700)]);
    expect(href).toBe(cssUrl("Inter", [n(400), n(700)]));
    expect(href).toBe("https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap");
  });

  it("returns the self-hosted sheet path for fontface families", () => {
    expect(previewHref({ slug: "blackout", family: "Blackout", preview: "fontface" }, [n(400)])).toBe(
      "/fontface/blackout.css",
    );
  });
});

const style = (weight: number, filename: string, s: "normal" | "italic" = "normal"): FontStyle => ({
  style: s,
  weight,
  filename,
  fullName: filename,
  url: `/fonts/x/${filename}`,
});

describe("fontFormat and fileFormatLabel", () => {
  it.each([
    ["Font-Regular.woff2", "woff2", "WOFF2"],
    ["Font.woff", "woff", "WOFF"],
    ["Font.otf", "opentype", "OTF"],
    ["Font.TTF", "truetype", "TTF"],
  ] as const)("%s", (filename, format, label) => {
    expect(fontFormat(filename)).toBe(format);
    expect(fileFormatLabel(filename)).toBe(label);
  });
});

describe("selfHostedFontFace", () => {
  it("emits one @font-face block per style using the downloaded file names", () => {
    const css = selfHostedFontFace({
      family: "Blackout",
      categories: [],
      styles: [style(400, "Blackout-Regular.otf"), style(400, "Blackout-Italic.otf", "italic")],
    });
    expect(css).toBe(
      [
        "@font-face {",
        "  font-family: 'Blackout';",
        "  font-style: normal;",
        "  font-weight: 400;",
        "  font-display: swap;",
        "  src: url('Blackout-Regular.otf') format('opentype');",
        "}",
        "",
        "@font-face {",
        "  font-family: 'Blackout';",
        "  font-style: italic;",
        "  font-weight: 400;",
        "  font-display: swap;",
        "  src: url('Blackout-Italic.otf') format('opentype');",
        "}",
      ].join("\n"),
    );
  });
});

describe("webSnippetBlocks", () => {
  const links = {
    linkTag: '<link rel="stylesheet" href="L">',
    importLine: "@import url('I');",
    fontFamilyLine: "font-family: 'Inter', sans-serif;",
  };

  it("keeps the three Google blocks for css2 families", () => {
    const blocks = webSnippetBlocks({ family: "Inter", styles: [], categories: [], preview: "css2" }, links);
    expect(blocks.map((b) => b.code)).toEqual([links.linkTag, links.importLine, links.fontFamilyLine]);
  });

  it("gives one self-hosting block for fontface families", () => {
    const blocks = webSnippetBlocks(
      { family: "Blackout", styles: [style(400, "B.otf")], categories: [], preview: "fontface" },
      links,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].label).toMatch(/self-host/);
    expect(blocks[0].code).toContain("src: url('B.otf') format('opentype');");
    expect(blocks[0].code.endsWith(links.fontFamilyLine)).toBe(true);
    expect(blocks[0].code).not.toContain("fonts.googleapis.com");
  });
});

