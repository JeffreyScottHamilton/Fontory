import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildFamily, dedupe } from "./build";
import type { FontFamily } from "../../src/lib/types";

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
