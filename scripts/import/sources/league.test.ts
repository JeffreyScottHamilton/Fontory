import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { importLeague, importLeagueRepo, LEAGUE_TABLE, type LeagueRepo } from "./league";

const FIXTURES = fileURLToPath(new URL("./__fixtures__/league/theleagueof", import.meta.url));
const SHA = "b".repeat(40);
const RAW = `https://raw.githubusercontent.com`;
const NO_CATEGORIES = new Map<string, string>();
const DATE = "2026-01-02";

const junctionSpec: LeagueRepo = LEAGUE_TABLE.find((r) => r.repo === "theleagueof/junction")!;

describe("LEAGUE_TABLE", () => {
  it("covers the four pinned repos and their families", () => {
    expect(LEAGUE_TABLE.map((r) => r.repo)).toEqual([
      "theleagueof/blackout",
      "theleagueof/chunk",
      "theleagueof/junction",
      "theleagueof/ostrich-sans",
    ]);
    const families = LEAGUE_TABLE.flatMap((r) => r.families.map((f) => f.family));
    expect(families).toEqual([
      "Blackout Midnight",
      "Blackout Sunrise",
      "Blackout Two AM",
      "ChunkFive",
      "ChunkFive Print",
      "Junction",
      "Ostrich Sans",
      "Ostrich Sans Dashed",
      "Ostrich Sans Inline",
      "Ostrich Sans Rounded",
    ]);
  });
});

describe("importLeagueRepo (fixtures)", () => {
  it("builds a family with otf files, quote-verified designer, and raw urls", () => {
    const r = importLeagueRepo(`${FIXTURES}/junction`, junctionSpec, SHA, NO_CATEGORIES, DATE);
    expect(r.excluded).toEqual([]);
    expect(r.families).toHaveLength(1);
    const f = r.families[0];
    expect(f.family).toBe("Junction");
    expect(f.slug).toBe("junction");
    expect(f.designer).toBe("Caroline Hadilaksono & Tyler Finck");
    expect(f.license).toBe("OFL");
    expect(f.licenseName).toBe("SIL Open Font License 1.1");
    expect(f.licenseFile).toBe("Open Font License.markdown");
    expect(f.licenseUrl).toBe(`${RAW}/theleagueof/junction/${SHA}/Open%20Font%20License.markdown`);
    expect(f.weights).toEqual([300, 400, 700]);
    expect(f.hasItalic).toBe(false);
    expect(f.styles.map((s) => s.filename)).toEqual(["Junction-light.otf", "Junction-regular.otf", "Junction-bold.otf"]);
    expect(f.styles[0].url).toBe(`${RAW}/theleagueof/junction/${SHA}/Junction-light.otf`);
    expect(f.styles[0].fullName).toBe("Junction Light");
    expect(f.source).toEqual({
      repo: "theleagueof/junction",
      commit: SHA,
      url: `https://github.com/theleagueof/junction/tree/${SHA}`,
      host: "github",
    });
    expect(f.repoPath).toBe("");
    expect(f.preview).toBe("fontface");
    expect(f.collection).toBe("league");
    expect(f.copyright).toBe('Copyright (c) 2010, Test Author <test@example.com>, with Reserved Font Name: "Junction".');
    expect(f.upstream).toBeNull();
    expect(f.categories).toEqual([]);
    expect(f.categoryEvidence).toEqual([]);
  });

  it("takes category evidence only from a matching fontsource category", () => {
    const r = importLeagueRepo(`${FIXTURES}/junction`, junctionSpec, SHA, new Map([["junction", "sans-serif"]]), DATE);
    expect(r.families[0].categories).toEqual(["sans-serif"]);
    expect(r.families[0].categoryEvidence).toEqual([
      { category: "sans-serif", source: "fontsource", detail: 'category: "sans-serif"' },
    ]);
  });

  it("falls back to ttf when no otf exists, and excludes families with no binary", () => {
    const spec: LeagueRepo = {
      repo: "theleagueof/blackout",
      families: [
        {
          family: "Blackout Midnight",
          designer: "Tyler Finck",
          designerQuote: "by [Tyler Finck](http://www.sursly.com)",
          faces: [{ base: "Blackout Midnight", weight: 400, style: "normal" }],
        },
        {
          family: "Blackout Two AM",
          designer: "Tyler Finck",
          designerQuote: "by [Tyler Finck](http://www.sursly.com)",
          faces: [{ base: "Blackout Two AM", weight: 400, style: "normal" }],
        },
      ],
    };
    const r = importLeagueRepo(`${FIXTURES}/blackout`, spec, SHA, NO_CATEGORIES, DATE);
    expect(r.families.map((f) => f.styles[0].filename)).toEqual(["Blackout Midnight.ttf"]);
    expect(r.excluded).toEqual([{ id: "Blackout Two AM", reason: "no binary for Blackout Two AM (.otf or .ttf)" }]);
  });

  it("excludes everything when the license text is not SIL OFL 1.1", () => {
    const spec: LeagueRepo = {
      repo: "theleagueof/not-ofl",
      families: [
        {
          family: "Not OFL",
          designer: "Some Designer",
          designerQuote: "by [Some Designer](http://example.com)",
          faces: [{ base: "Not OFL", weight: 400, style: "normal" }],
        },
      ],
    };
    const r = importLeagueRepo(`${FIXTURES}/not-ofl`, spec, SHA, NO_CATEGORIES, DATE);
    expect(r.families).toEqual([]);
    expect(r.excluded).toEqual([{ id: "Not OFL", reason: "license text is not SIL OFL 1.1" }]);
  });

  it("excludes a family whose designer quote is not in the readme", () => {
    const spec: LeagueRepo = {
      repo: "theleagueof/junction",
      families: [{ ...junctionSpec.families[0], designerQuote: "by [Someone Else](http://example.com)" }],
    };
    const r = importLeagueRepo(`${FIXTURES}/junction`, spec, SHA, NO_CATEGORIES, DATE);
    expect(r.families).toEqual([]);
    expect(r.excluded).toEqual([{ id: "Junction", reason: "designer quote not found in readme.markdown" }]);
  });
});

const REAL_ROOT = fileURLToPath(new URL("../../../.cache/sources", import.meta.url));
const HAVE_REAL = existsSync(`${REAL_ROOT}/theleagueof/junction/.git`) && existsSync(`${REAL_ROOT}/fontsource/font-files/.git`);

describe.skipIf(!HAVE_REAL)("league table vs real pinned clones", () => {
  it("every table file exists in the clone", () => {
    for (const repo of LEAGUE_TABLE) {
      const dir = `${REAL_ROOT}/${repo.repo}`;
      for (const fam of repo.families) {
        for (const face of fam.faces) {
          const found = [".otf", ".ttf"].some((ext) => existsSync(`${dir}/${face.base}${ext}`));
          expect(found, `${repo.repo}: ${face.base}`).toBe(true);
        }
      }
    }
  });

  it("imports all ten families with OFL and no exclusions", () => {
    const lg = importLeague(REAL_ROOT);
    expect(lg.collection).toBe("league");
    expect(lg.excluded).toEqual([]);
    expect(lg.families.map((f) => f.family)).toHaveLength(10);
    expect(lg.families.every((f) => f.license === "OFL")).toBe(true);
    const chunk = lg.families.find((f) => f.family === "ChunkFive");
    expect(chunk?.categories).toEqual(["serif"]);
  });
});
