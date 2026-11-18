import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  copyrightHeader,
  detectLicense,
  importVelvetyne,
  importVelvetyneFrom,
  readVelvetynePins,
  VELVETYNE_EXCLUDED,
  VELVETYNE_TABLE,
  vendorVelvetyne,
  type VelvetynePins,
  type VvProjectSpec,
} from "./velvetyne";

const FIXTURES = fileURLToPath(new URL("./__fixtures__/velvetyne", import.meta.url));
const CACHE = `${FIXTURES}/cache`;
const OFL_LICENSE = `${CACHE}/velvetyne/fixture-ofl/LICENSE.txt`;
const NONOFL_LICENSE = `${CACHE}/velvetyne/fixture-nonofl/LICENSE.txt`;
const REAL_CACHE = fileURLToPath(new URL("../../../.cache/sources", import.meta.url));
const SHA = "c".repeat(40);

const PINS: VelvetynePins = {
  group: "velvetyne",
  projects: [
    { project: "fixture-ofl", id: 1, defaultBranch: "master", sha: SHA, commitDate: "2024-03-04" },
    { project: "fixture-nonofl", id: 2, defaultBranch: "master", sha: "d".repeat(40), commitDate: "2024-03-05" },
  ],
};

const TABLE: VvProjectSpec[] = [
  {
    project: "fixture-ofl",
    licenseFile: "LICENSE.txt",
    families: [
      {
        family: "Fixture Sans",
        designer: "Test Designer",
        faces: [
          { file: "fonts/otf/Fixture-Regular.otf", weight: 400, style: "normal", preview: "fonts/webfonts/Fixture-Regular.woff2" },
          { file: "fonts/otf/Fixture-Italic.otf", weight: 400, style: "italic" },
        ],
      },
    ],
  },
  {
    project: "fixture-nonofl",
    licenseFile: "LICENSE.txt",
    families: [{ family: "Fixture Other", designer: "Test Designer", faces: [{ file: "fonts/otf/Other.otf", weight: 400, style: "normal" }] }],
  },
];

describe("detectLicense", () => {
  it("accepts verbatim SIL OFL 1.1 text", () => {
    expect(detectLicense(readFileSync(OFL_LICENSE, "utf8"))).toBe("OFL");
  });

  it("is insensitive to line wrapping and CRLF", () => {
    const text = readFileSync(OFL_LICENSE, "utf8").replace(/\r?\n/g, "\r\n");
    expect(detectLicense(text)).toBe("OFL");
  });

  it("rejects a license with one altered clause", () => {
    expect(detectLicense(readFileSync(NONOFL_LICENSE, "utf8"))).toBeNull();
  });

  it("rejects text without a PREAMBLE", () => {
    expect(detectLicense("MIT License\n\nPermission is hereby granted")).toBeNull();
  });
});

describe("copyrightHeader", () => {
  it("returns the first copyright line before the OFL preamble", () => {
    expect(copyrightHeader(readFileSync(OFL_LICENSE, "utf8"))).toBe("Copyright (c) 2024, Fixture Designer");
  });

  it("returns an empty string when the header has no copyright line", () => {
    expect(copyrightHeader("SIL OPEN FONT LICENSE Version 1.1\n\nPREAMBLE\nbody")).toBe("");
  });
});

describe("importVelvetyneFrom (fixtures)", () => {
  const result = importVelvetyneFrom(CACHE, PINS, TABLE, []);

  it("imports only the OFL project and excludes the non-OFL one with a reason", () => {
    expect(result.collection).toBe("velvetyne");
    expect(result.families.map((f) => f.family)).toEqual(["Fixture Sans"]);
    expect(result.excluded).toEqual([
      { id: "fixture-nonofl", reason: "LICENSE.txt is not verbatim SIL OFL 1.1 text" },
    ]);
  });

  it("selects the table download files and omits previews that are not in the table", () => {
    const fam = result.families[0];
    expect(fam.slug).toBe("fixture-sans");
    expect(fam.styles.map((s) => s.filename).sort()).toEqual(["Fixture-Italic.otf", "Fixture-Regular.otf"]);
    expect(fam.styles.find((s) => s.style === "italic")?.previewUrl).toBeUndefined();
    expect(fam.styles.find((s) => s.style === "normal")?.previewUrl).toBe(
      "/fonts/velvetyne/fixture-sans/Fixture-Regular.woff2",
    );
  });

  it("builds URLs under /fonts/velvetyne/<slug>/", () => {
    const fam = result.families[0];
    expect(fam.licenseUrl).toBe("/fonts/velvetyne/fixture-sans/LICENSE.txt");
    expect(fam.styles.map((s) => s.url).sort()).toEqual([
      "/fonts/velvetyne/fixture-sans/Fixture-Italic.otf",
      "/fonts/velvetyne/fixture-sans/Fixture-Regular.otf",
    ]);
  });

  it("fills contract fields from the pin and the table", () => {
    const fam = result.families[0];
    expect(fam.license).toBe("OFL");
    expect(fam.designer).toBe("Test Designer");
    expect(fam.weights).toEqual([400]);
    expect(fam.hasItalic).toBe(true);
    expect(fam.isVariable).toBe(false);
    expect(fam.preview).toBe("fontface");
    expect(fam.collection).toBe("velvetyne");
    expect(fam.dateAdded).toBe("2024-03-04");
    expect(fam.copyright).toBe("Copyright (c) 2024, Fixture Designer");
    expect(fam.source).toEqual({
      repo: "velvetyne/fixture-ofl",
      commit: SHA,
      url: `https://gitlab.com/velvetyne/fixture-ofl/-/tree/${SHA}`,
      host: "gitlab",
    });
  });

  it("excludes a table project that has no pin", () => {
    const r = importVelvetyneFrom(CACHE, { group: "velvetyne", projects: [] }, TABLE, []);
    expect(r.families).toEqual([]);
    expect(r.excluded.map((e) => e.reason)).toEqual([
      "not pinned in velvetyne-pins.json",
      "not pinned in velvetyne-pins.json",
    ]);
  });

  it("throws when a table file is missing at the pinned sha", () => {
    const bad: VvProjectSpec[] = [
      {
        project: "fixture-ofl",
        licenseFile: "LICENSE.txt",
        families: [{ family: "Fixture Gone", designer: "x", faces: [{ file: "fonts/otf/Missing.otf", weight: 400, style: "normal" }] }],
      },
    ];
    expect(() => importVelvetyneFrom(CACHE, PINS, bad, [])).toThrow(/Missing\.otf missing at pinned sha/);
  });

  it("throws when the license file is missing", () => {
    const bad: VvProjectSpec[] = [{ ...TABLE[0], licenseFile: "NOPE.txt" }];
    expect(() => importVelvetyneFrom(CACHE, PINS, bad, [])).toThrow(/NOPE\.txt missing/);
  });
});

describe("VELVETYNE_TABLE and pins (repo data)", () => {
  const pins = readVelvetynePins();

  it("pins every table project and no excluded project", () => {
    const pinned = new Set(pins.projects.map((p) => p.project));
    for (const spec of VELVETYNE_TABLE) expect(pinned.has(spec.project), spec.project).toBe(true);
    for (const e of VELVETYNE_EXCLUDED) expect(VELVETYNE_TABLE.some((s) => s.project === e.project)).toBe(false);
  });

  it("uses only 40-character shas and unique family slugs", () => {
    for (const p of pins.projects) expect(p.sha).toMatch(/^[0-9a-f]{40}$/);
    const families = VELVETYNE_TABLE.flatMap((s) => s.families.map((f) => f.family));
    expect(new Set(families).size).toBe(families.length);
  });

  it("gives every face a download in otf or ttf", () => {
    for (const spec of VELVETYNE_TABLE)
      for (const fam of spec.families)
        for (const face of fam.faces) expect(face.file).toMatch(/\.(otf|ttf)$/);
  });

  it.skipIf(!existsSync(`${REAL_CACHE}/velvetyne`))("imports the pinned clones with no error", () => {
    const r = importVelvetyne(REAL_CACHE);
    expect(r.families.length).toBe(31);
    expect(r.families.every((f) => f.license === "OFL")).toBe(true);
  });
});

describe("vendorVelvetyne", () => {
  it("rejects a family that is not in the velvetyne table", () => {
    const fam = importVelvetyneFrom(CACHE, PINS, TABLE, []).families[0];
    expect(() => vendorVelvetyne(CACHE, `${FIXTURES}/out`, [{ ...fam, slug: "not-in-table" }])).toThrow(
      /no velvetyne table entry for not-in-table/,
    );
  });
});
