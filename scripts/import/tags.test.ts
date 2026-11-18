import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { categoriesFromTags, keptTags, parseFamiliesCsv, familyTagRows } from "./tags";

const sample = readFileSync(fileURLToPath(new URL("./__fixtures__/families-sample.csv", import.meta.url)), "utf8");

describe("parseFamiliesCsv", () => {
  it("handles quoted fields with commas and doubled quotes", () => {
    const rows = parseFamiliesCsv(sample);
    expect(rows.find((r) => r.family === "Quoted, Name")).toMatchObject({ tag: "/Theme/Pixel", score: 50 });
    expect(rows.find((r) => r.family === 'Escaped "Quote"')).toMatchObject({ tag: "/Theme/Blackletter", score: 75 });
  });

  it("reads the axis column even when it is a quoted list with commas", () => {
    const rows = parseFamiliesCsv(sample);
    const advent = rows.filter((r) => r.family === "Advent Pro");
    expect(advent.length).toBeGreaterThan(0);
    expect(advent[0].tag).toMatch(/^\//);
    expect(typeof advent[0].score).toBe("number");
  });

  it("tolerates CRLF line endings and blank lines", () => {
    const rows = parseFamiliesCsv("A,,/Theme/Pixel,60\r\n\r\nB,wght@400,/Theme/Pixel,10\r\n");
    expect(rows).toEqual([
      { family: "A", axes: "", tag: "/Theme/Pixel", score: 60 },
      { family: "B", axes: "wght@400", tag: "/Theme/Pixel", score: 10 },
    ]);
  });
});

describe("familyTagRows / keptTags", () => {
  it("keeps the best score per (family, tag) and applies score >= 50", () => {
    const rows = familyTagRows(parseFamiliesCsv(sample));
    const inter = rows.get("Inter")!;
    expect(inter.get("/Theme/Pixel")).toBe(80); // max of 49 and 80
    expect(keptTags(inter)).toEqual(["/Sans/Neo Grotesque", "/Theme/Art Deco", "/Theme/Pixel"]);
  });

  it("drops /Quality, /quant, /Fontquant and /Skip prefixes", () => {
    const rows = familyTagRows(parseFamiliesCsv(
      "X,,/Quality/Spacing,99\nX,,/quant/stroke,99\nX,,/Fontquant/x,99\nX,,/Skip/Stroke Width,100\nX,,/Sans/Humanist,60\n",
    ));
    expect(keptTags(rows.get("X")!)).toEqual(["/Sans/Humanist"]);
  });
});

describe("categoriesFromTags", () => {
  it("maps the contract tags to categories with score evidence", () => {
    const tags = new Map([
      ["/Expressive/Vintage", 60],
      ["/Theme/Blackletter", 50],
      ["/Theme/Pixel", 100],
      ["/Theme/Tuscan", 70],
      ["/Theme/Woodtype", 90],
      ["/Theme/Inline", 55],
      ["/Theme/Shaded", 55],
      ["/Theme/Art Nouveau", 55],
      ["/Theme/Art Deco", 55],
      ["/Theme/Techno", 100],
      ["/Sans/Humanist", 100],
    ]);
    const ev = categoriesFromTags(tags);
    const cats = new Set(ev.map((e) => e.category));
    expect(cats).toEqual(new Set(["retro", "gothic", "pixel", "decorative"]));
    expect(ev).toContainEqual({ category: "pixel", source: "tag", detail: "/Theme/Pixel=100" });
    expect(ev).toContainEqual({ category: "retro", source: "tag", detail: "/Expressive/Vintage=60" });
    expect(ev).toContainEqual({ category: "gothic", source: "tag", detail: "/Theme/Blackletter=50" });
  });

  it("ignores tags below score 50", () => {
    expect(categoriesFromTags(new Map([["/Theme/Pixel", 49]]))).toEqual([]);
  });
});
