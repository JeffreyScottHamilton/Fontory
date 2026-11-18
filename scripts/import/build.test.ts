import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildFamily, dedupe, dedupeAcross, fontfaceCss } from "./build";
import type { CollectionId, FontFamily } from "../../src/lib/types";

const FIXTURES = fileURLToPath(new URL("./__fixtures__/", import.meta.url));

// Minimal METADATA.pb text for one family with the given font file blocks.
function metadataText(name: string, license: string, files: { filename: string; style?: string; weight?: number }[]): string {
  const fonts = files
    .map((f) => `fonts {
  name: "${name}"
  style: "${f.style ?? "normal"}"
  weight: ${f.weight ?? 400}
  filename: "${f.filename}"
  full_name: "${name} ${f.filename}"
  copyright: "Copyright 2020 Test"
}
`)
    .join("");
  return `name: "${name}"
designer: "Test Designer"
license: "${license}"
date_added: "2020-01-01"
${fonts}`;
}

let root: string;

// Writes <srcDir>/<repoPath>/METADATA.pb (and the license file, unless omitted) and returns the repoPath.
function writeRepo(repoPath: string, metadata: string, licenseFile: string | null): string {
  const dir = path.join(root, repoPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "METADATA.pb"), metadata);
  if (licenseFile) writeFileSync(path.join(dir, licenseFile), "License text\n");
  return repoPath;
}

function build(repoPath: string) {
  return buildFamily(repoPath, root, new Map(), new Set());
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "fontory-build-test-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("dedupe", () => {
  // Builds a FontFamily through the real pipeline so the fixture shape is never hand-written.
  function family(repoPath: string, name: string): FontFamily {
    writeRepo(repoPath, metadataText(name, "OFL", [{ filename: `${name.replace(/\s+/g, "")}-Regular.ttf` }]), "OFL.txt");
    const result = build(repoPath);
    if (!("family" in result)) throw new Error(`fixture ${repoPath} excluded: ${result.reason}`);
    return result.family;
  }

  it("keeps one family when the same family name appears in two license dirs", () => {
    const apache = family("apache/foo", "Foo Sans");
    const ofl = family("ofl/foo", "Foo Sans");
    const { kept, duplicates } = dedupe([apache, ofl]);
    expect(kept.map((f) => f.repoPath)).toEqual(["apache/foo"]);
    expect(duplicates).toEqual([
      { repoPath: "ofl/foo", family: "Foo Sans", slug: "foo-sans", keptRepoPath: "apache/foo", reason: "duplicate family name" },
    ]);
  });

  it("reports a slug collision between differently named families", () => {
    const a = family("ofl/alpha", "Foo Bar");
    const b = family("ofl/beta", "Foo-Bar");
    const { kept, duplicates } = dedupe([a, b]);
    expect(kept.map((f) => f.repoPath)).toEqual(["ofl/alpha"]);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toMatchObject({ repoPath: "ofl/beta", keptRepoPath: "ofl/alpha", reason: "slug collision" });
  });

  it("keeps every family when names and slugs are distinct", () => {
    const a = family("ofl/alpha", "Alpha Sans");
    const b = family("ofl/beta", "Beta Sans");
    const { kept, duplicates } = dedupe([a, b]);
    expect(kept.map((f) => f.family)).toEqual(["Alpha Sans", "Beta Sans"]);
    expect(duplicates).toEqual([]);
  });
});

describe("style file dedupe (buildFamily)", () => {
  it("drops a second file for the same style and weight, keeping the first", () => {
    writeRepo("ofl/foo", metadataText("Foo", "OFL", [{ filename: "Foo-Regular.ttf" }, { filename: "Foo-Copy.ttf" }]), "OFL.txt");
    const result = build("ofl/foo");
    if (!("family" in result)) throw new Error(result.reason);
    expect(result.droppedStyles).toEqual(["Foo-Copy.ttf"]);
    expect(result.family.styles.map((s) => s.filename)).toEqual(["Foo-Regular.ttf"]);
  });

  it("prefers a static file over a variable file for the same style and weight", () => {
    writeRepo("ofl/foo", metadataText("Foo", "OFL", [{ filename: "Foo[wght].ttf" }, { filename: "Foo-Regular.ttf" }]), "OFL.txt");
    const result = build("ofl/foo");
    if (!("family" in result)) throw new Error(result.reason);
    expect(result.droppedStyles).toEqual(["Foo[wght].ttf"]);
    expect(result.family.styles.map((s) => s.filename)).toEqual(["Foo-Regular.ttf"]);
  });
});

describe("validation exclusions (buildFamily)", () => {
  it("builds the Inter fixture when its license file is present", () => {
    const repoPath = "ofl/inter";
    const dir = path.join(root, repoPath);
    mkdirSync(dir, { recursive: true });
    copyFileSync(path.join(FIXTURES, "ofl-inter-METADATA.pb"), path.join(dir, "METADATA.pb"));
    writeFileSync(path.join(dir, "OFL.txt"), "License text\n");
    const result = build(repoPath);
    if (!("family" in result)) throw new Error(result.reason);
    expect(result.family.family).toBe("Inter");
    expect(result.family.licenseFile).toBe("OFL.txt");
  });

  it("excludes a family whose license file is missing from the repo dir", () => {
    writeRepo("ofl/foo", metadataText("Foo", "OFL", [{ filename: "Foo-Regular.ttf" }]), null);
    expect(build("ofl/foo")).toEqual({ reason: "license file OFL.txt missing in repo dir" });
  });

  it("excludes a family with a non ttf/otf font file", () => {
    writeRepo("ofl/foo", metadataText("Foo", "OFL", [{ filename: "Foo-Regular.woff2" }]), "OFL.txt");
    expect(build("ofl/foo")).toEqual({ reason: "unsupported file type: Foo-Regular.woff2" });
  });

  it("accepts .otf and upper-case extensions", () => {
    writeRepo("ofl/foo", metadataText("Foo", "OFL", [{ filename: "Foo-Regular.OTF" }]), "OFL.txt");
    expect("family" in build("ofl/foo")).toBe(true);
  });
});

// Minimal non-Google family for cross-collection dedupe tests.
function collectionFamily(collection: CollectionId, family: string, slug = family.toLowerCase().replace(/\s+/g, "-")): FontFamily {
  return {
    slug,
    family,
    designer: "Test",
    license: "OFL",
    licenseName: "SIL Open Font License 1.1",
    licenseFile: "LICENSE.txt",
    licenseUrl: "/fonts/x/LICENSE.txt",
    categories: [],
    categoryEvidence: [],
    tags: [],
    styles: [{ style: "normal", weight: 400, filename: `${slug}.otf`, fullName: family, url: `/fonts/x/${slug}.otf` }],
    weights: [400],
    hasItalic: false,
    axes: [],
    isVariable: false,
    subsets: [],
    dateAdded: "2020-01-01",
    repoPath: "",
    source: { repo: `${collection}/x`, commit: "abc", url: "https://example.com", host: "github" },
    upstream: null,
    copyright: "",
    related: [],
    preview: "fontface",
    collection,
  };
}

describe("dedupeAcross", () => {
  it("keeps the higher-priority collection when normalized names match", () => {
    const google = collectionFamily("google-fonts", "Noto Sans", "noto-sans");
    const fontsource = collectionFamily("fontsource", "Noto-Sans", "noto-sans-fontsource");
    const { kept, duplicates } = dedupeAcross([google, fontsource]);
    expect(kept.map((f) => f.collection)).toEqual(["google-fonts"]);
    expect(duplicates).toEqual([
      {
        collection: "fontsource",
        id: "fontsource/x",
        family: "Noto-Sans",
        slug: "noto-sans-fontsource",
        keptCollection: "google-fonts",
        keptId: "google-fonts/x",
        reason: "duplicate family name (normalized)",
      },
    ]);
  });

  it("reports a slug collision across collections", () => {
    const league = collectionFamily("league", "Ostrich Sans", "ostrich");
    const velvetyne = collectionFamily("velvetyne", "Ostrich", "ostrich");
    const { kept, duplicates } = dedupeAcross([league, velvetyne]);
    expect(kept).toHaveLength(1);
    expect(duplicates[0]).toMatchObject({ collection: "velvetyne", keptCollection: "league", reason: "slug collision" });
  });

  it("keeps families from every collection when names and slugs are distinct", () => {
    const a = collectionFamily("velvetyne", "Basteleur Moonlight");
    const b = collectionFamily("league", "Blackout Sunrise");
    const { kept, duplicates } = dedupeAcross([a, b]);
    expect(kept).toHaveLength(2);
    expect(duplicates).toEqual([]);
  });
});

describe("fontfaceCss", () => {
  it("emits one @font-face per style with the exact family name, weight, style and format", () => {
    const f = collectionFamily("velvetyne", "Basteleur Moonlight");
    f.styles = [
      { style: "normal", weight: 300, filename: "Basteleur-Moonlight.otf", fullName: "x", url: "/fonts/velvetyne/basteleur-moonlight/Basteleur-Moonlight.otf", previewUrl: "/fonts/velvetyne/basteleur-moonlight/Basteleur-Moonlight.woff2" },
      { style: "italic", weight: 400, filename: "Italic.ttf", fullName: "y", url: "https://raw.example/Italic.ttf" },
    ];
    expect(fontfaceCss(f)).toBe(
      [
        "@font-face {",
        "  font-family: 'Basteleur Moonlight';",
        "  font-style: normal;",
        "  font-weight: 300;",
        "  font-display: swap;",
        "  src: url('/fonts/velvetyne/basteleur-moonlight/Basteleur-Moonlight.woff2') format('woff2');",
        "}",
        "",
        "@font-face {",
        "  font-family: 'Basteleur Moonlight';",
        "  font-style: italic;",
        "  font-weight: 400;",
        "  font-display: swap;",
        "  src: url('https://raw.example/Italic.ttf') format('truetype');",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("escapes quotes in the family name and advertises the wght range for variable files", () => {
    const f = collectionFamily("google-fonts", "Ma'lam");
    f.axes = [{ tag: "wght", min: 100, max: 900 }];
    f.styles = [{ style: "normal", weight: 400, filename: "Ma[wght].ttf", fullName: "x", url: "https://raw.example/Ma%5Bwght%5D.ttf" }];
    const css = fontfaceCss(f);
    expect(css).toContain("font-family: 'Ma\\'lam';");
    expect(css).toContain("font-weight: 100 900;");
  });
});
