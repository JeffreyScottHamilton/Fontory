import { describe, expect, it } from "vitest";
import { cssSnippet, cssUrl } from "./google-css";

const n = (weight: number): { weight: number; style: "normal" } => ({ weight, style: "normal" });
const i = (weight: number): { weight: number; style: "italic" } => ({ weight, style: "italic" });

describe("cssUrl", () => {
  it("builds a wght-only css2 URL with spaces as +, sorted and deduped", () => {
    expect(cssUrl("IBM Plex Sans", [n(700), n(400), n(400)])).toBe(
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;700&display=swap",
    );
  });

  it("uses ital,wght tuples when any style is italic, normal before italic", () => {
    expect(cssUrl("Inter", [i(400), n(400)])).toBe(
      "https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;1,400&display=swap",
    );
  });

  it("sorts ital tuples by ital first, then weight", () => {
    expect(cssUrl("Inter", [i(100), n(900), n(100), i(700)])).toBe(
      "https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,100;0,900;1,100;1,700&display=swap",
    );
  });

  it("appends an encoded text parameter when requested", () => {
    expect(cssUrl("Inter", [n(400)], { text: "Hi & bye ü" })).toBe(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap&text=Hi%20%26%20bye%20%C3%BC",
    );
  });

  it("encodes other special characters in the family name", () => {
    expect(cssUrl("Playwrite AR", [n(400)])).toContain("family=Playwrite+AR:wght@400");
  });
});

describe("cssSnippet", () => {
  const fs = (weight: number) => ({
    ...n(weight),
    filename: `FiraCode-${weight}.ttf`,
    fullName: `Fira Code ${weight}`,
    url: `https://example.invalid/${weight}.ttf`,
  });
  const base = { family: "Fira Code", styles: [fs(400), fs(700)] };

  it("returns link, @import and font-family lines", () => {
    const s = cssSnippet({ ...base, categories: ["monospace"] });
    const url = cssUrl("Fira Code", [n(400), n(700)]);
    expect(s.linkTag).toBe(`<link rel="stylesheet" href="${url}">`);
    expect(s.importLine).toBe(`@import url('${url}');`);
    expect(s.fontFamilyLine).toBe("font-family: 'Fira Code', monospace;");
  });

  it.each([
    [["serif"], "serif"],
    [["handwriting"], "cursive"],
    [["sans-serif"], "sans-serif"],
    [["display"], "sans-serif"],
    [[], "sans-serif"],
  ] as const)("maps %j to generic %s", (categories, generic) => {
    expect(cssSnippet({ ...base, categories: [...categories] }).fontFamilyLine).toBe(
      `font-family: 'Fira Code', ${generic};`,
    );
  });

  it("prefers monospace over serif when both are present", () => {
    expect(cssSnippet({ ...base, categories: ["serif", "monospace"] }).fontFamilyLine).toBe(
      "font-family: 'Fira Code', monospace;",
    );
  });
});
