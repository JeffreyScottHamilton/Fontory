import { unzipSync, strFromU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildZipEntries, familyReadme, type FamilyZipSource } from "./family-zip";

const family: FamilyZipSource = {
  family: "Inter",
  licenseFile: "OFL.txt",
  licenseUrl: "https://example.com/OFL.txt",
  source: { url: "https://github.com/google/fonts/tree/abc/ofl/inter" },
  styles: [
    { filename: "Inter-Regular.ttf", fullName: "Inter Regular", url: "https://example.com/a", weight: 400, style: "normal" },
    { filename: "Inter-Italic.ttf", fullName: "Inter Italic", url: "https://example.com/b", weight: 400, style: "italic" },
  ],
};

describe("familyReadme", () => {
  it("names the family, source and license file", () => {
    expect(familyReadme(family)).toBe(
      [
        "Inter",
        "",
        "Source: https://github.com/google/fonts/tree/abc/ofl/inter",
        "",
        "The font files in this folder are from Google Fonts. The license in OFL.txt applies to them.",
        "",
      ].join("\n"),
    );
  });
});

describe("buildZipEntries", () => {
  it("lays out <family>/<license>, style files and README.txt", () => {
    const zipped = zipSync(
      buildZipEntries(family, new Uint8Array([1]), [new Uint8Array([2]), new Uint8Array([3])]),
      { level: 0 },
    );
    const files = unzipSync(zipped);
    // fflate also writes a directory entry ("Inter/"); only file entries are checked.
    expect(Object.keys(files).filter((k) => !k.endsWith("/")).sort()).toEqual(
      [
        "Inter/OFL.txt",
        "Inter/Inter-Regular.ttf",
        "Inter/Inter-Italic.ttf",
        "Inter/README.txt",
      ].sort(),
    );
    expect(Array.from(files["Inter/Inter-Italic.ttf"])).toEqual([3]);
    expect(strFromU8(files["Inter/README.txt"])).toBe(familyReadme(family));
  });
});
