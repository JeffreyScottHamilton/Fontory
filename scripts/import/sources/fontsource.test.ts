import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { importFontsource, importFontsourceFrom, mapCategory, slugify } from "./fontsource";

const FIXTURE_REPO = fileURLToPath(new URL("./__fixtures__/fontsource", import.meta.url));
const SHA = "a".repeat(40);
const DATE = "2026-01-02";
const RAW = `https://raw.githubusercontent.com/fontsource/font-files/${SHA}/fonts/other`;

const result = importFontsourceFrom(FIXTURE_REPO, SHA, DATE);
const byId = (id: string) => result.families.find((f) => f.repoPath === `fonts/other/${id}`);
const excludedReason = (id: string) => result.excluded.find((e) => e.id === id)?.reason;

describe("importFontsourceFrom (fixtures)", () => {
  it("includes families that have a usable license and one file per style", () => {
    expect(result.collection).toBe("fontsource");
    expect(result.families.map((f) => f.family).sort()).toEqual(["Only Subset", "Tiny Latin"]);
  });

  it("excludes with a reason for each rule", () => {
    expect(excludedReason("reserved-font")).toBe('LICENSE contains "Reserved Font Name"');
    expect(excludedReason("no-license")).toBe("no LICENSE file");
    expect(excludedReason("gpl-font")).toBe('license "GPL-3.0" not allowed');
    expect(excludedReason("split-font")).toBe("400 normal: split into 3 unicode-range subsets");
    expect(excludedReason("missing-weight")).toBe("no woff2 for 600 normal");
    expect(result.excluded.map((e) => e.id).sort()).toEqual(
      ["gpl-font", "missing-weight", "no-license", "reserved-font", "split-font"].sort(),
    );
  });

  it("prefers the latin subset when several subsets exist", () => {
    const f = byId("tiny-latin");
    expect(f).toBeDefined();
    expect(f?.styles.map((s) => s.filename)).toEqual([
      "tiny-latin-latin-400-normal.woff2",
      "tiny-latin-latin-400-italic.woff2",
      "tiny-latin-latin-700-normal.woff2",
      "tiny-latin-latin-700-italic.woff2",
    ]);
    expect(f?.styles.every((s) => s.filename.includes("-latin-"))).toBe(true);
    expect(f?.subsets).toEqual(["latin", "latin-ext"]);
    expect(f?.weights).toEqual([400, 700]);
    expect(f?.hasItalic).toBe(true);
  });

  it("uses the only subset when there is exactly one and maps MIT and unknown categories", () => {
    const f = byId("only-subset");
    expect(f?.styles).toHaveLength(1);
    expect(f?.styles[0].filename).toBe("only-subset-vietnamese-400-normal.woff2");
    expect(f?.license).toBe("MIT");
    expect(f?.licenseName).toBe("MIT License");
    expect(f?.categories).toEqual([]);
    expect(f?.categoryEvidence).toEqual([]);
  });

  it("builds url, licenseUrl, source and fontface/collection fields", () => {
    const f = byId("tiny-latin");
    expect(f?.slug).toBe("tiny-latin");
    expect(f?.styles[0].url).toBe(`${RAW}/tiny-latin/files/tiny-latin-latin-400-normal.woff2`);
    expect(f?.licenseFile).toBe("LICENSE");
    expect(f?.licenseUrl).toBe(`${RAW}/tiny-latin/LICENSE`);
    expect(f?.source).toEqual({
      repo: "fontsource/font-files",
      commit: SHA,
      url: `https://github.com/fontsource/font-files/tree/${SHA}/fonts/other/tiny-latin`,
      host: "github",
    });
    expect(f?.preview).toBe("fontface");
    expect(f?.collection).toBe("fontsource");
    expect(f?.license).toBe("OFL");
    expect(f?.licenseName).toBe("SIL Open Font License 1.1");
    expect(f?.dateAdded).toBe(DATE);
    expect(f?.copyright).toBe("Copyright (c) 2020, Jane Doe <jane@example.com>");
    expect(f?.upstream).toEqual({ repositoryUrl: "https://example.com/tiny-latin" });
    expect(f?.tags).toEqual([]);
    expect(f?.axes).toEqual([]);
    expect(f?.isVariable).toBe(false);
    expect(f?.related).toEqual([]);
  });

  it("records category evidence from metadata.json", () => {
    const f = byId("tiny-latin");
    expect(f?.categories).toEqual(["sans-serif"]);
    expect(f?.categoryEvidence).toEqual([
      { category: "sans-serif", source: "fontsource", detail: 'category: "sans-serif"' },
    ]);
  });
});

describe("helpers", () => {
  it("slugify matches build.ts", () => {
    expect(slugify("Adwaita Mono")).toBe("adwaita-mono");
    expect(slugify("  Ostrich Sans & Co.  ")).toBe("ostrich-sans-co");
  });

  it("mapCategory maps only the five contract categories", () => {
    expect(mapCategory("serif")).toBe("serif");
    expect(mapCategory("monospace")).toBe("monospace");
    expect(mapCategory("other")).toBeNull();
    expect(mapCategory(undefined)).toBeNull();
  });
});

const REAL_ROOT = fileURLToPath(new URL("../../../.cache/sources", import.meta.url));
const HAVE_REAL = existsSync(`${REAL_ROOT}/fontsource/font-files/.git`);

describe.skipIf(!HAVE_REAL)("importFontsource (real pinned clone)", () => {
  it("imports only non-RFN, latin-or-single-subset families at the pinned commit", () => {
    const real = importFontsource(REAL_ROOT);
    expect(real.families.length).toBeGreaterThan(0);
    expect(real.families.length + real.excluded.length).toBe(119);
    for (const f of real.families) {
      expect(f.source.commit).toBe("5a72889057f592bb0659629e38337359f94d53b2");
      expect(f.styles.length).toBeGreaterThan(0);
      for (const s of f.styles) expect(s.url).toContain("/fonts/other/");
    }
    expect(real.excluded.every((e) => e.reason.length > 0)).toBe(true);
  });
});
