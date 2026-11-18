import { describe, expect, it } from "vitest";
import { filterFonts } from "@/lib/search";
import type { FontIndexEntry } from "@/lib/types";

function entry(over: Partial<FontIndexEntry> & { family: string }): FontIndexEntry {
  return {
    slug: over.family.toLowerCase().replace(/\s+/g, "-"),
    designer: "Anon",
    categories: ["sans-serif"],
    weights: [400],
    hasItalic: false,
    isVariable: false,
    styleCount: 1,
    dateAdded: "2020-01-01",
    previewWeight: 400,
    previewStyle: "normal",
    preview: "css2",
    collection: "google-fonts",
    ...over,
  };
}

const INDEX: FontIndexEntry[] = [
  entry({ family: "Inter", designer: "Rasmus Andersson", styleCount: 18, dateAdded: "2020-05-01", isVariable: true, hasItalic: true, categories: ["sans-serif"] }),
  entry({ family: "Inter Tight", designer: "Rasmus Andersson", styleCount: 9, dateAdded: "2022-01-10", isVariable: true, categories: ["sans-serif"] }),
  entry({ family: "Pixelify Sans", designer: "Stefie Justprince", styleCount: 6, dateAdded: "2022-09-01", categories: ["pixel", "sans-serif"] }),
  entry({ family: "Press Start 2P", designer: "Cody Boisclair", styleCount: 1, dateAdded: "2019-03-03", categories: ["pixel"] }),
  entry({ family: "Playfair Display", designer: "Claus Eggers Sørensen", styleCount: 20, dateAdded: "2021-07-07", hasItalic: true, categories: ["serif", "display"] }),
  entry({ family: "Lora", designer: "Cyreal", styleCount: 8, dateAdded: "2021-02-02", hasItalic: true, isVariable: true, categories: ["serif"] }),
  entry({ family: "Abril Inter Fatface", designer: "TypeType", styleCount: 1, dateAdded: "2023-04-04", categories: ["display", "decorative"] }),
];

const slugs = (xs: FontIndexEntry[]) => xs.map((x) => x.family);

describe("filterFonts: empty query and sorting", () => {
  it("sorts by family asc for sort 'az'", () => {
    const out = filterFonts(INDEX, { categories: [], sort: "az" });
    expect(slugs(out)).toEqual([
      "Abril Inter Fatface",
      "Inter",
      "Inter Tight",
      "Lora",
      "Pixelify Sans",
      "Playfair Display",
      "Press Start 2P",
    ]);
  });

  it("sorts by dateAdded desc then family for sort 'newest'", () => {
    const out = filterFonts(INDEX, { categories: [], sort: "newest" });
    expect(slugs(out)[0]).toBe("Abril Inter Fatface");
    expect(slugs(out)[slugs(out).length - 1]).toBe("Press Start 2P");
  });

  it("sorts by styleCount desc then family for sort 'styles'", () => {
    const out = filterFonts(INDEX, { categories: [], sort: "styles" });
    expect(slugs(out).slice(0, 3)).toEqual(["Playfair Display", "Inter", "Inter Tight"]);
  });

  it("does not mutate the input array", () => {
    const copy = [...INDEX];
    filterFonts(INDEX, { categories: [], sort: "newest" });
    expect(INDEX).toEqual(copy);
  });

  it("returns all entries when no filters are set", () => {
    expect(filterFonts(INDEX, { categories: [], sort: "az" })).toHaveLength(INDEX.length);
  });
});

describe("filterFonts: text query", () => {
  it("matches family case-insensitively", () => {
    expect(slugs(filterFonts(INDEX, { q: "INTER", categories: [], sort: "az" }))).toEqual([
      "Inter",
      "Inter Tight",
      "Abril Inter Fatface",
    ]);
  });

  it("matches designer", () => {
    expect(slugs(filterFonts(INDEX, { q: "sørensen", categories: [], sort: "az" }))).toEqual([
      "Playfair Display",
    ]);
  });

  it("ANDs whitespace-separated tokens across family and designer", () => {
    expect(slugs(filterFonts(INDEX, { q: "inter andersson", categories: [], sort: "az" }))).toEqual([
      "Inter",
      "Inter Tight",
    ]);
    expect(slugs(filterFonts(INDEX, { q: "pixel boisclair", categories: [], sort: "az" }))).toEqual([]);
  });

  it("ignores surrounding and repeated whitespace", () => {
    expect(slugs(filterFonts(INDEX, { q: "   press   start  ", categories: [], sort: "az" }))).toEqual([
      "Press Start 2P",
    ]);
  });

  it("ranks exact family, then family prefix, then family contains, then designer", () => {
    const out = slugs(filterFonts(INDEX, { q: "inter", categories: [], sort: "styles" }));
    // exact: Inter; prefix: Inter Tight; contains: Abril Inter Fatface; designer-only matches have no 'inter' in family
    expect(out).toEqual(["Inter", "Inter Tight", "Abril Inter Fatface"]);
  });

  it("ranks designer-only matches after family matches", () => {
    const out = slugs(filterFonts(INDEX, { q: "andersson", categories: [], sort: "az" }));
    expect(out).toEqual(["Inter", "Inter Tight"]);
    const mixed = slugs(
      filterFonts(
        [
          entry({ family: "Zeta Andersson Face", designer: "Other" }),
          entry({ family: "Alpha", designer: "Andersson" }),
        ],
        { q: "andersson", categories: [], sort: "az" },
      ),
    );
    expect(mixed).toEqual(["Zeta Andersson Face", "Alpha"]);
  });

  it("uses the sort key to break relevance ties", () => {
    const out = slugs(filterFonts(INDEX, { q: "inter", categories: [], sort: "newest" }));
    // Inter (exact) first, then prefix, then contains
    expect(out).toEqual(["Inter", "Inter Tight", "Abril Inter Fatface"]);
  });

  it("returns nothing for a query that matches nothing", () => {
    expect(filterFonts(INDEX, { q: "zzz-no-match", categories: [], sort: "az" })).toEqual([]);
  });
});

describe("filterFonts: categories", () => {
  it("ORs selected categories", () => {
    expect(slugs(filterFonts(INDEX, { categories: ["pixel", "serif"], sort: "az" }))).toEqual([
      "Lora",
      "Pixelify Sans",
      "Playfair Display",
      "Press Start 2P",
    ]);
  });

  it("returns all entries when no categories are selected", () => {
    expect(filterFonts(INDEX, { categories: [], sort: "az" })).toHaveLength(INDEX.length);
  });

  it("combines with text query using AND", () => {
    expect(slugs(filterFonts(INDEX, { q: "press", categories: ["serif"], sort: "az" }))).toEqual([]);
    expect(slugs(filterFonts(INDEX, { q: "press", categories: ["pixel"], sort: "az" }))).toEqual([
      "Press Start 2P",
    ]);
  });
});

describe("filterFonts: italic and variable flags", () => {
  it("italic: true keeps only fonts with italics", () => {
    const out = slugs(filterFonts(INDEX, { categories: [], italic: true, sort: "az" }));
    expect(out).toEqual(["Inter", "Lora", "Playfair Display"]);
  });

  it("variable: true keeps only variable fonts", () => {
    const out = slugs(filterFonts(INDEX, { categories: [], variable: true, sort: "az" }));
    expect(out).toEqual(["Inter", "Inter Tight", "Lora"]);
  });

  it("italic: false and variable: false do not filter", () => {
    expect(filterFonts(INDEX, { categories: [], italic: false, variable: false, sort: "az" })).toHaveLength(
      INDEX.length,
    );
  });

  it("combines italic and variable", () => {
    expect(slugs(filterFonts(INDEX, { categories: [], italic: true, variable: true, sort: "az" }))).toEqual([
      "Inter",
      "Lora",
    ]);
  });
});
