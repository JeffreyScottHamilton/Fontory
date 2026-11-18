import { unzipSync, strFromU8, zipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildFamilyZip, buildZipEntries, familyReadme, type FamilyZipSource } from "./family-zip";

const family: FamilyZipSource = {
  family: "Inter",
  licenseFile: "OFL.txt",
  licenseUrl: "https://example.com/OFL.txt",
  licenseName: "SIL Open Font License 1.1",
  source: { repo: "google/fonts", url: "https://github.com/google/fonts/tree/abc/ofl/inter" },
  styles: [
    { filename: "Inter-Regular.ttf", fullName: "Inter Regular", url: "https://example.com/a", weight: 400, style: "normal" },
    { filename: "Inter-Italic.ttf", fullName: "Inter Italic", url: "https://example.com/b", weight: 400, style: "italic" },
  ],
};

// Velvetyne-style: GitLab project, site-relative file URLs (vendored under public/fonts/velvetyne).
const velvetyne: FamilyZipSource = {
  family: "Basteleur Moonlight",
  licenseFile: "LICENSE.txt",
  licenseUrl: "/fonts/velvetyne/basteleur-moonlight/LICENSE.txt",
  licenseName: "SIL Open Font License 1.1",
  source: { repo: "velvetyne/basteleur", url: "https://gitlab.com/velvetyne/basteleur/-/tree/f32302d6" },
  styles: [
    {
      filename: "Basteleur-Moonlight.otf",
      fullName: "Basteleur Moonlight",
      url: "/fonts/velvetyne/basteleur-moonlight/Basteleur-Moonlight.otf",
      weight: 300,
      style: "normal",
    },
  ],
};

describe("familyReadme", () => {
  it("names the source repository, its URL and the license name and file", () => {
    expect(familyReadme(family)).toBe(
      [
        "Inter",
        "",
        "Source repository: google/fonts",
        "Source: https://github.com/google/fonts/tree/abc/ofl/inter",
        "License: SIL Open Font License 1.1 (OFL.txt)",
        "",
        "The font files in this folder are from google/fonts. The license in OFL.txt applies to them.",
        "",
      ].join("\n"),
    );
  });

  it("names the GitLab repository of a velvetyne-like family", () => {
    const readme = familyReadme(velvetyne);
    expect(readme).toContain("Source repository: velvetyne/basteleur\n");
    expect(readme).toContain("Source: https://gitlab.com/velvetyne/basteleur/-/tree/f32302d6\n");
    expect(readme).toContain("License: SIL Open Font License 1.1 (LICENSE.txt)\n");
    expect(readme).toContain("from velvetyne/basteleur. The license in LICENSE.txt applies to them.");
  });

  it("falls back to the source URL when the repository is unknown", () => {
    const readme = familyReadme({ ...family, licenseName: undefined, source: { url: family.source.url } });
    expect(readme).not.toContain("Source repository");
    expect(readme).not.toContain("License:");
    expect(readme).toContain("from the source above.");
  });
});

describe("buildFamilyZip with site-relative URLs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the vendored license and style files by their site-relative paths", async () => {
    const requested: string[] = [];
    vi.stubGlobal(
      "fetch",
      async (url: string) => {
        requested.push(url);
        return new Response(new Uint8Array([0, 1, 0, 0]), { status: 200 });
      },
    );
    const zipped = await buildFamilyZip(velvetyne);
    expect(requested.sort()).toEqual([
      "/fonts/velvetyne/basteleur-moonlight/Basteleur-Moonlight.otf",
      "/fonts/velvetyne/basteleur-moonlight/LICENSE.txt",
    ]);
    const files = unzipSync(zipped);
    expect(Object.keys(files).filter((k) => !k.endsWith("/")).sort()).toEqual([
      "Basteleur Moonlight/Basteleur-Moonlight.otf",
      "Basteleur Moonlight/LICENSE.txt",
      "Basteleur Moonlight/README.txt",
    ]);
    expect(strFromU8(files["Basteleur Moonlight/README.txt"])).toBe(familyReadme(velvetyne));
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
