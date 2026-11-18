import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseMetadata } from "./parse-metadata";
import { familyWeights, previewFor } from "./weights";

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");

const ALL = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const file = (style: "normal" | "italic", weight: number) => ({ style, weight });

describe("familyWeights (variable fonts)", () => {
  it("expands a wght axis 100-900 from the real Inter METADATA fixture", () => {
    const meta = parseMetadata(fixture("ofl-inter-METADATA.pb"));
    const axes = meta.axes.map((a) => ({ tag: a.tag, min: a.minValue!, max: a.maxValue! }));
    expect(familyWeights(axes, [file("normal", 400), file("italic", 400)])).toEqual(ALL);
  });

  it("uses only standard weights inside the axis range", () => {
    const axes = [{ tag: "wght", min: 150, max: 850 }];
    expect(familyWeights(axes, [file("normal", 400)])).toEqual([200, 300, 400, 500, 600, 700, 800]);
  });

  it("ignores axes other than wght", () => {
    const axes = [{ tag: "opsz", min: 8, max: 144 }];
    expect(familyWeights(axes, [file("normal", 400)])).toEqual([400]);
  });

  it("keeps static file weights when there is no axis", () => {
    expect(familyWeights([], [file("normal", 700), file("normal", 300)])).toEqual([300, 700]);
  });

  it("unions file weights outside the standard range with the axis range", () => {
    expect(familyWeights([{ tag: "wght", min: 100, max: 300 }], [file("normal", 950)])).toEqual([100, 200, 300, 950]);
  });
});

describe("previewFor", () => {
  it("uses 400 when 400 is in range, normal style first", () => {
    expect(previewFor({ styles: [file("normal", 400), file("italic", 400)], weights: ALL })).toEqual({ previewWeight: 400, previewStyle: "normal" });
  });

  it("falls back to the closest weight, ties going lighter", () => {
    expect(previewFor({ styles: [file("normal", 300), file("normal", 700)], weights: [300, 700] })).toEqual({ previewWeight: 300, previewStyle: "normal" });
    expect(previewFor({ styles: [file("normal", 100), file("normal", 300)], weights: [100, 300] })).toEqual({ previewWeight: 300, previewStyle: "normal" });
  });

  it("uses italic only when no normal style exists", () => {
    expect(previewFor({ styles: [file("italic", 400)], weights: [400] })).toEqual({ previewWeight: 400, previewStyle: "italic" });
  });
});
