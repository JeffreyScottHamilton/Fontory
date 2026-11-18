// Imports velvetyne (gitlab.com/velvetyne) projects from pinned clones under <cacheRoot>/velvetyne/<project>.
// A project is imported only if its license file text is verbatim SIL OFL 1.1 (detectLicense; never from names).
// Families and per-file weight/style come from VELVETYNE_TABLE; each entry cites the repo file it was read from.
// Download format is otf (else ttf); the woff2 preview is used where the repo ships one.
// GitLab raw has no CORS, so vendorVelvetyne copies files UNMODIFIED into public/fonts/velvetyne/<slug>/.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import type { CategoryEvidence, FontFamily, FontStyle } from "../../../src/lib/types";
import { fullStyleName, LICENSE_NAMES, slugify, sortStyles, type SourceImport } from "./fontsource";

const COLLECTION = "velvetyne" as const;
const VENDOR_CAP_BYTES = 60 * 1024 * 1024;
const PINS_PATH = path.join(__dirname, "velvetyne-pins.json");
// sha256 of the lowercased, [a-z0-9]-only text from "PREAMBLE" to the end of SIL OFL 1.1 (Gulax/LICENSE.txt).
// Insensitive to line wrapping, CRLF, markdown and punctuation; any reworded clause changes it.
const OFL_11_SHA256 = "34c1733fea6ab21201493ee83acdb34a204bd04657ac660f04a771a796b9bad7";

export interface VelvetynePin {
  project: string;
  id: number;
  defaultBranch: string;
  sha: string;
  commitDate: string;
}
export interface VelvetynePins {
  group: string;
  projects: VelvetynePin[];
}
export interface VvFace {
  file: string; // download file (otf or ttf), repo-relative
  weight: number;
  style: "normal" | "italic";
  preview?: string; // woff2, repo-relative, when the repo ships one
}
export interface VvFamilySpec {
  family: string;
  designer: string;
  faces: VvFace[];
}
export interface VvProjectSpec {
  project: string;
  licenseFile: string; // repo-relative
  families: VvFamilySpec[];
}
export interface Excluded {
  project: string;
  reason: string;
}

// Source notes: "README" = <project>/README.md, "FONTLOG" = FONTLOG.md|txt, "FONTINFO" = FONTINFO.json,
// "LICENSE" = copyright line of the license file, "METADATA" = METADATA.yml|yaml.
// METADATA is often a stale template (e.g. letters/METADATA.yml says "Sligoil", interlope says "Gabriel"),
// so family names are taken from the font name table (nameID 16, else 1) and checked against README.
// Weight is the OS/2 usWeightClass of the file, except where two faces of one family collide (noted).
export const VELVETYNE_TABLE: VvProjectSpec[] = [
  {
    // Facade-font/README.md: four cardinal designs; nameID 16 is "Facade" for all, so each is its own family.
    // Weights are the declared OS/2 values (900, 100, 100, 400); each family has a single face.
    project: "Facade-font",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "Facade Est", designer: "Éléonore Fines", faces: [{ file: "fonts/Static/OTF/Facade-Est.otf", weight: 900, style: "normal", preview: "fonts/Static/WEB/Facade-Est.woff2" }] },
      { family: "Facade Ouest", designer: "Éléonore Fines", faces: [{ file: "fonts/Static/OTF/Facade-Ouest.otf", weight: 100, style: "normal", preview: "fonts/Static/WEB/Facade-Ouest.woff2" }] },
      { family: "Facade Sud", designer: "Éléonore Fines", faces: [{ file: "fonts/Static/OTF/Facade-Sud.otf", weight: 100, style: "normal", preview: "fonts/Static/WEB/Facade-Sud.woff2" }] },
      { family: "Facade Sud-Ouest", designer: "Éléonore Fines", faces: [{ file: "fonts/Static/OTF/Facade-Sud-Ouest.otf", weight: 400, style: "normal", preview: "fonts/Static/WEB/Facade-Sud-Ouest.woff2" }] },
    ],
  },
  {
    // Gulax/README.md: designed by Morgan Gilbert. Name table: "Gulax", OS/2 400.
    project: "Gulax",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "Gulax", designer: "Morgan Gilbert", faces: [{ file: "fonts/otf/Gulax-Regular.otf", weight: 400, style: "normal", preview: "fonts/webfonts/Gulax-Regular.woff2" }] },
    ],
  },
  {
    // Happy-Times-at-the-IKOB/README.md: designed by Lucas Le Bihan. Name table family (no nameID 16) and OS/2 per file.
    project: "Happy-Times-at-the-IKOB",
    licenseFile: "LICENSE.txt",
    families: [
      {
        family: "Happy Times at the IKOB New Game Plus Edition",
        designer: "Lucas Le Bihan",
        faces: [
          { file: "fonts/otf/happy-times-NG_regular_master.otf", weight: 400, style: "normal", preview: "fonts/webfonts/happy-times-NG_regular_master_web.woff2" },
          { file: "fonts/otf/happy-times-NG_bold_master.otf", weight: 700, style: "normal", preview: "fonts/webfonts/happy-times-NG_bold_master_web.woff2" },
          { file: "fonts/otf/happy-times-NG_italic_master.otf", weight: 400, style: "italic", preview: "fonts/webfonts/happy-times-NG_italic_master_web.woff2" },
        ],
      },
    ],
  },
  {
    // Mess/FONTLOG.md: "Mess is a typeface designed by Tezzo Suzuki". Name table nameID 16 "Mess", OS/2 400.
    project: "Mess",
    licenseFile: "licence.txt",
    families: [
      { family: "Mess", designer: "Tezzo Suzuki", faces: [{ file: "fonts/Mess.otf", weight: 400, style: "normal", preview: "fonts/webfonts/Mess-Light_web.woff2" }] },
    ],
  },
  {
    // Sporting-Grotesque/COPYRIGHT.md and README.md: Lucas Le Bihan. Name table "Sporting Grotesque", OS/2 400/700.
    project: "Sporting-Grotesque",
    licenseFile: "LICENSE.txt",
    families: [
      {
        family: "Sporting Grotesque",
        designer: "Lucas Le Bihan",
        faces: [
          { file: "fonts/SportingGrotesque-Regular.otf", weight: 400, style: "normal", preview: "webfonts/Regular/Sporting_Grotesque-Regular_web.woff2" },
          { file: "fonts/SportingGrotesque-Bold.otf", weight: 700, style: "normal", preview: "webfonts/Bold/Sporting_Grotesque-Bold_web.woff2" },
        ],
      },
    ],
  },
  {
    // Trickster/README.md: "a typeface by Jean-Baptiste Morizot". Name table "Trickster", OS/2 400.
    project: "Trickster",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "Trickster", designer: "Jean-Baptiste Morizot", faces: [{ file: "fonts/Trickster-Reg.otf", weight: 400, style: "normal", preview: "webfonts/Trickster-Regular.woff2" }] },
    ],
  },
  {
    // amdal/METADATA.yml: family "Amdal". License copyright: Walid Bouchouchi (Akakir Studio). OS/2 700.
    project: "amdal",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "Amdal", designer: "Walid Bouchouchi", faces: [{ file: "fonts/AMDAL-Regular.otf", weight: 700, style: "normal", preview: "fonts/webfonts/AMDAL-Regular.woff2" }] },
    ],
  },
  {
    // anthony/LICENSE.txt: "Copyright (c) 2021 Sun Young Oh". Name table "Anthony", OS/2 400.
    project: "anthony",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "Anthony", designer: "Sun Young Oh", faces: [{ file: "fonts/Anthony.otf", weight: 400, style: "normal", preview: "fonts/web/Anthony.woff2" }] },
    ],
  },
  {
    // backout/FONTINFO.json: name "BackOut", weight "medium", authors Frank Adebiaye and Ariel Martín Pérez. OS/2 500.
    project: "backout",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "BackOut", designer: "Frank Adebiaye, Ariel Martín Pérez", faces: [{ file: "fonts/BackOut.otf", weight: 500, style: "normal", preview: "fonts/webfonts/BackOut.woff2" }] },
    ],
  },
  {
    // basteleur/LICENSE.txt: "Copyright (c) 2021, Keussel". Name table nameID 16 "Basteleur" but nameID 1 is
    // "Basteleur Bold" and "Basteleur Moonlight" (two distinct designs), so each is its own family.
    project: "basteleur",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "Basteleur Bold", designer: "Keussel", faces: [{ file: "fonts/otf/Basteleur-Bold.otf", weight: 400, style: "normal", preview: "fonts/webfonts/Basteleur-Bold.woff2" }] },
      { family: "Basteleur Moonlight", designer: "Keussel", faces: [{ file: "fonts/otf/Basteleur-Moonlight.otf", weight: 300, style: "normal", preview: "fonts/webfonts/Basteleur-Moonlight.woff2" }] },
    ],
  },
  {
    // cantique/FONTLOG.md: "N: Sébastien Hayez ... Typeface designer". Name table "Cantique", OS/2 400.
    project: "cantique",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "Cantique", designer: "Sébastien Hayez", faces: [{ file: "fonts/Cantique-Normal.otf", weight: 400, style: "normal", preview: "fonts/web/Cantique-Normal.woff2" }] },
    ],
  },
  {
    // compagnon/README.md: five styles drawn by Juliette Duhé, Léa Pradine, Valentin Papon, Sébastien Riollier, Chloé Lozano.
    // Name table nameID 16 "Compagnon". Light is declared OS/2 400, the same as Roman, so it is set to 300 (its style name).
    // Light Italic has no webfont with that name, so it has no preview.
    project: "compagnon",
    licenseFile: "LICENSE.txt",
    families: [
      {
        family: "Compagnon",
        designer: "Juliette Duhé, Léa Pradine, Valentin Papon, Sébastien Riollier, Chloé Lozano",
        faces: [
          { file: "fonts/Compagnon-Light.otf", weight: 300, style: "normal", preview: "fonts/webfonts/Compagnon-Light.woff2" },
          { file: "fonts/Compagnon-LightItalic.otf", weight: 400, style: "italic" },
          { file: "fonts/Compagnon-Roman.otf", weight: 400, style: "normal", preview: "fonts/webfonts/Compagnon-Roman.woff2" },
          { file: "fonts/Compagnon-Medium.otf", weight: 600, style: "normal", preview: "fonts/webfonts/Compagnon-Medium.woff2" },
          { file: "fonts/Compagnon-Bold.otf", weight: 700, style: "normal", preview: "fonts/webfonts/Compagnon-Bold.woff2" },
        ],
      },
    ],
  },
  {
    // format-1452/FONTLOG.md: "Format 1452 v1.0 (Frank Adebiaye)", v2.0 by Anton Moglia. Name table "Format_1452", OS/2 500.
    // sources/Original folder/ is a source copy and is not used.
    project: "format-1452",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "Format 1452", designer: "Frank Adebiaye, Anton Moglia", faces: [{ file: "fonts/otf/Format_1452.otf", weight: 500, style: "normal", preview: "fonts/webfonts/Format_1452.woff2" }] },
    ],
  },
  {
    // imago-mundi-mei/FONTINFO.json: authors "A collective", name "ImagoMundiMei", weight "regular". OS/2 400.
    project: "imago-mundi-mei",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "Imago Mundi Mei", designer: "A collective", faces: [{ file: "fonts/ImagoMundiMei-Regular.otf", weight: 400, style: "normal", preview: "fonts/webfonts/ImagoMundiMei-Regular.woff2" }] },
    ],
  },
  {
    // interlope/README.md: "created by Gabriel Dubourg". Name table "Interlope", OS/2 400. METADATA.yml names "Gabriel" (stale).
    project: "interlope",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "Interlope", designer: "Gabriel Dubourg", faces: [{ file: "font/otf/Interlope-Regular.otf", weight: 400, style: "normal", preview: "font/web/Interlope-Regular.woff2" }] },
    ],
  },
  {
    // grotesk/README.md: Frank Adebiaye (2010), new version by Ariel Martín Pérez (2023). Name table nameID 16 "Grotesk".
    // OS/2 is 100, 400, 400, 500 for 01 Extrafin, 02 Mince, 03 Regular, 04 Gras. Mince and Regular collide at 400,
    // so Mince is set to 300 (its style name). Verify against the font before relying on the 300.
    project: "grotesk",
    licenseFile: "LICENSE.txt",
    families: [
      {
        family: "Grotesk",
        designer: "Frank Adebiaye, Ariel Martín Pérez",
        faces: [
          { file: "fonts/Grotesk-01Extrafin.otf", weight: 100, style: "normal", preview: "fonts/_web/Grotesk-01Extrafin.woff2" },
          { file: "fonts/Grotesk-02Mince.otf", weight: 300, style: "normal", preview: "fonts/_web/Grotesk-02Mince.woff2" },
          { file: "fonts/Grotesk-03Regular.otf", weight: 400, style: "normal", preview: "fonts/_web/Grotesk-03Regular.woff2" },
          { file: "fonts/Grotesk-04Gras.otf", weight: 500, style: "normal", preview: "fonts/_web/Grotesk-04Gras.woff2" },
        ],
      },
    ],
  },
  {
    // jgs/README.md: "Jgs Font ... declined in three fonts" jgs5, jgs7, jgs9 (licence names the same three).
    // Only TTF binaries exist in fonts/ (no OTF), so the TTF is the download. fonts/jgs_Font.ttf is not in the README
    // and is not used.
    project: "jgs",
    licenseFile: "LICENSE",
    families: [
      { family: "jgs5", designer: "Adel Faure", faces: [{ file: "fonts/jgs5.ttf", weight: 400, style: "normal", preview: "fonts/webfonts/jgs5.woff2" }] },
      { family: "jgs7", designer: "Adel Faure", faces: [{ file: "fonts/jgs7.ttf", weight: 400, style: "normal", preview: "fonts/webfonts/jgs7.woff2" }] },
      { family: "jgs9", designer: "Adel Faure", faces: [{ file: "fonts/jgs9.ttf", weight: 400, style: "normal", preview: "fonts/webfonts/jgs9.woff2" }] },
    ],
  },
  {
    // kaerukaeru/FONTLOG.md: "Kaeru Kaeru is a typeface designed by Isabel Motz". Name table "kaeru kaeru", OS/2 400.
    project: "kaerukaeru",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "Kaeru Kaeru", designer: "Isabel Motz", faces: [{ file: "fonts/kaerukaeru-Regular.otf", weight: 400, style: "normal", preview: "fonts/webfonts/kaerukaeru-Regular.woff2" }] },
    ],
  },
  {
    // letters/README.md: "Letters ... available in regular and italic styles", by Céline Hurka and Jules Janssen.
    // Name table nameID 16 "Letters": Torn is Regular (normal), Lavish is Italic (italic bit set).
    project: "letters",
    licenseFile: "LICENSE.txt",
    families: [
      {
        family: "Letters",
        designer: "Céline Hurka, Jules Janssen",
        faces: [
          { file: "fonts/Letters-Torn.otf", weight: 400, style: "normal", preview: "fonts/web/Letters-Torn.woff2" },
          { file: "fonts/Letters-Lavish.otf", weight: 400, style: "italic", preview: "fonts/web/Letters-Lavish.woff2" },
        ],
      },
    ],
  },
  {
    // lineal/README.md: Frank Adebiaye (original), Anton Moglia, Ariel Martín Pérez. Name table nameID 16 "Lineal".
    // Static OTF weights are the declared OS/2 values (200 to 900).
    project: "lineal",
    licenseFile: "LICENSE.txt",
    families: [
      {
        family: "Lineal",
        designer: "Frank Adebiaye, Anton Moglia, Ariel Martín Pérez",
        faces: [
          { file: "fonts/Static/OTF/Lineal-Thin.otf", weight: 200, style: "normal", preview: "fonts/Static/WEB/Lineal-Thin.woff2" },
          { file: "fonts/Static/OTF/Lineal-Light.otf", weight: 300, style: "normal", preview: "fonts/Static/WEB/Lineal-Light.woff2" },
          { file: "fonts/Static/OTF/Lineal-Regular.otf", weight: 400, style: "normal", preview: "fonts/Static/WEB/Lineal-Regular.woff2" },
          { file: "fonts/Static/OTF/Lineal-Medium.otf", weight: 600, style: "normal", preview: "fonts/Static/WEB/Lineal-Medium.woff2" },
          { file: "fonts/Static/OTF/Lineal-Bold.otf", weight: 700, style: "normal", preview: "fonts/Static/WEB/Lineal-Bold.woff2" },
          { file: "fonts/Static/OTF/Lineal-Black.otf", weight: 800, style: "normal", preview: "fonts/Static/WEB/Lineal-Black.woff2" },
          { file: "fonts/Static/OTF/Lineal-Heavy.otf", weight: 900, style: "normal", preview: "fonts/Static/WEB/Lineal-Heavy.woff2" },
        ],
      },
    ],
  },
  {
    // mourier/FONTLOG.md: "Mourier by Eric Mourier". License copyright 1971 Eric Mourier. Name table "Mourier", OS/2 400.
    project: "mourier",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "Mourier", designer: "Eric Mourier", faces: [{ file: "fonts/Mourier-Regular.otf", weight: 400, style: "normal", preview: "fonts/webfonts/Mourier-Regular.woff2" }] },
    ],
  },
  {
    // murmure/LICENSE.txt: "Copyright (c) 2020, Jérémy Landes". Name table "Le Murmure", OS/2 600.
    project: "murmure",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "Le Murmure", designer: "Jérémy Landes", faces: [{ file: "fonts/le-murmure.otf", weight: 600, style: "normal", preview: "fonts/webfonts/LeMurmure-Regular.woff2" }] },
    ],
  },
  {
    // ouroboros/LICENSE.txt: "Copyright (c) 2018-2020, Ariel Martín Pérez". Name table "Ouroboros", OS/2 400.
    project: "ouroboros",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "Ouroboros", designer: "Ariel Martín Pérez", faces: [{ file: "fonts/Ouroboros-Regular.otf", weight: 400, style: "normal", preview: "fonts/webfonts/Ouroboros-Regular.woff2" }] },
    ],
  },
  {
    // sligoil/README.md: "created by Ariel Martín Pérez". Name table nameID 16 "Sligoil": Micro 400, Micro Medium 500, Micro Bold 700.
    project: "sligoil",
    licenseFile: "LICENSE.txt",
    families: [
      {
        family: "Sligoil",
        designer: "Ariel Martín Pérez",
        faces: [
          { file: "fonts/otf/Sligoil-Micro.otf", weight: 400, style: "normal", preview: "fonts/web/Sligoil-Micro.woff2" },
          { file: "fonts/otf/Sligoil-MicroMedium.otf", weight: 500, style: "normal", preview: "fonts/web/Sligoil-MicroMedium.woff2" },
          { file: "fonts/otf/Sligoil-MicroBold.otf", weight: 700, style: "normal", preview: "fonts/web/Sligoil-MicroBold.woff2" },
        ],
      },
    ],
  },
  {
    // vg5000/COPYRIGHT.md: "Copyright (c) 2015-2018, Justin Bihan"; README: "a typeface by Justin Bihan". Name table "VG5000", OS/2 400.
    project: "vg5000",
    licenseFile: "LICENSE.txt",
    families: [
      { family: "VG5000", designer: "Justin Bihan", faces: [{ file: "fonts/VG5000-Regular.otf", weight: 400, style: "normal", preview: "fonts/webfonts/VG5000-Regular_web.woff2" }] },
    ],
  },
];

// Projects in the velvetyne group that are NOT imported, with the reason. Checked by hand against the clones.
export const VELVETYNE_EXCLUDED: Excluded[] = [
  { project: "Avara", reason: "no license file in repo (README only); license not guessed" },
  { project: "lack", reason: "no license file in repo; license not guessed" },
  { project: "Velvetyne-Notdef", reason: "no license file in repo (README only); license not guessed" },
  { project: "Velvetyne-Standard-Character-Set", reason: "MIT License text; no font files" },
  { project: "velvetyne-libre-friends", reason: "no font files in repo" },
  { project: "pilowlava3D", reason: "Free Art License 1.3 text, not SIL OFL 1.1; no font files" },
  { project: "fungal", reason: "license text is Bitstream/DejaVu-derived, not SIL OFL 1.1" },
  { project: "flor-des-ruina", reason: "LICENSE.txt is OFL-based but the warranty wording is altered (not verbatim OFL 1.1); not guessed" },
  { project: "feroniapi", reason: "LICENSE.txt is verbatim OFL 1.1 but README.md states the CUTE licence; conflict, excluded pending review" },
];

function projectDir(cacheRoot: string, project: string): string {
  return path.join(cacheRoot, "velvetyne", project);
}

// Returns "OFL" only when the license body is verbatim SIL OFL 1.1 (see OFL_11_SHA256).
export function detectLicense(text: string): "OFL" | null {
  const lower = text.toLowerCase();
  const i = lower.indexOf("preamble");
  if (i < 0) return null;
  const body = lower.slice(i).replace(/[^a-z0-9]/g, "");
  return createHash("sha256").update(body).digest("hex") === OFL_11_SHA256 ? "OFL" : null;
}

// First "Copyright" line of the license header (text before the OFL PREAMBLE); "" when there is none.
export function copyrightHeader(text: string): string {
  const i = text.toLowerCase().indexOf("preamble");
  const head = i < 0 ? text : text.slice(0, i);
  const line = head.split(/\r?\n/).map((l) => l.trim()).find((l) => /^copyright\b/i.test(l));
  return line ?? "";
}

export function readVelvetynePins(): VelvetynePins {
  return JSON.parse(readFileSync(PINS_PATH, "utf8")) as VelvetynePins;
}

function buildFamily(spec: VvProjectSpec, pin: VelvetynePin, fam: VvFamilySpec, copyright: string): FontFamily {
  const slug = slugify(fam.family);
  const base = `/fonts/velvetyne/${slug}`;
  const styles: FontStyle[] = fam.faces.map((f) => {
    const style: FontStyle = {
      style: f.style,
      weight: f.weight,
      filename: path.posix.basename(f.file),
      fullName: fullStyleName(fam.family, f.weight, f.style),
      url: `${base}/${path.posix.basename(f.file)}`,
    };
    if (f.preview) style.previewUrl = `${base}/${path.posix.basename(f.preview)}`;
    return style;
  });
  const sorted = sortStyles(styles);
  const categoryEvidence: CategoryEvidence[] = [];
  return {
    slug,
    family: fam.family,
    designer: fam.designer,
    license: "OFL",
    licenseName: LICENSE_NAMES.OFL,
    licenseFile: spec.licenseFile,
    licenseUrl: `${base}/${path.posix.basename(spec.licenseFile)}`,
    categories: [],
    categoryEvidence,
    tags: [],
    styles: sorted,
    weights: [...new Set(sorted.map((s) => s.weight))].sort((a, b) => a - b),
    hasItalic: sorted.some((s) => s.style === "italic"),
    axes: [],
    isVariable: false,
    subsets: [],
    dateAdded: pin.commitDate,
    repoPath: "",
    source: {
      repo: `velvetyne/${spec.project}`,
      commit: pin.sha,
      url: `https://gitlab.com/velvetyne/${spec.project}/-/tree/${pin.sha}`,
      host: "gitlab",
    },
    upstream: null,
    copyright,
    related: [],
    preview: "fontface",
    collection: COLLECTION,
  };
}

// Pure with respect to the network: reads only the clones under cacheRoot and the pins file.
export function importVelvetyneFrom(
  cacheRoot: string,
  pins: VelvetynePins,
  table: VvProjectSpec[],
  explicitExcluded: Excluded[] = VELVETYNE_EXCLUDED,
): SourceImport {
  const families: FontFamily[] = [];
  const excluded: SourceImport["excluded"] = explicitExcluded.map((e) => ({ id: e.project, reason: e.reason }));
  const seen = new Set<string>();
  for (const spec of table) {
    const pin = pins.projects.find((p) => p.project === spec.project);
    if (!pin) {
      excluded.push({ id: spec.project, reason: "not pinned in velvetyne-pins.json" });
      continue;
    }
    const dir = projectDir(cacheRoot, spec.project);
    const licPath = path.join(dir, spec.licenseFile);
    if (!existsSync(licPath)) {
      throw new Error(`velvetyne/${spec.project}: ${spec.licenseFile} missing; run scripts/import/fetch-velvetyne.sh`);
    }
    const licText = readFileSync(licPath, "utf8");
    if (detectLicense(licText) !== "OFL") {
      excluded.push({ id: spec.project, reason: `${spec.licenseFile} is not verbatim SIL OFL 1.1 text` });
      continue;
    }
    const copyright = copyrightHeader(licText);
    for (const fam of spec.families) {
      for (const face of fam.faces) {
        for (const rel of [face.file, face.preview]) {
          if (rel && !existsSync(path.join(dir, rel))) {
            throw new Error(`velvetyne/${spec.project}: ${rel} missing at pinned sha`);
          }
        }
      }
      const built = buildFamily(spec, pin, fam, copyright);
      if (seen.has(built.slug)) throw new Error(`duplicate velvetyne slug ${built.slug}`);
      seen.add(built.slug);
      families.push(built);
    }
  }
  return { collection: COLLECTION, families, excluded };
}

export function importVelvetyne(cacheRoot: string): SourceImport {
  return importVelvetyneFrom(cacheRoot, readVelvetynePins(), VELVETYNE_TABLE);
}

// Copies each family's download file, woff2 preview and license file UNMODIFIED into <publicDir>/<slug>/.
// publicDir is public/fonts/velvetyne. Returns the bytes copied.
export function vendorVelvetyne(cacheRoot: string, publicDir: string, families: FontFamily[]): { bytes: number } {
  const bySlug = new Map<string, { spec: VvProjectSpec; fam: VvFamilySpec }>();
  for (const spec of VELVETYNE_TABLE) {
    for (const fam of spec.families) bySlug.set(slugify(fam.family), { spec, fam });
  }
  let bytes = 0;
  for (const family of families) {
    const entry = bySlug.get(family.slug);
    if (!entry) throw new Error(`no velvetyne table entry for ${family.slug}`);
    const srcDir = projectDir(cacheRoot, entry.spec.project);
    const dest = path.join(publicDir, family.slug);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    const rels = new Set<string>([entry.spec.licenseFile]);
    for (const face of entry.fam.faces) {
      rels.add(face.file);
      if (face.preview) rels.add(face.preview);
    }
    for (const rel of rels) {
      const src = path.join(srcDir, rel);
      copyFileSync(src, path.join(dest, path.posix.basename(rel)));
      bytes += statSync(src).size;
    }
  }
  if (bytes > VENDOR_CAP_BYTES) {
    throw new Error(`velvetyne vendored ${bytes} bytes exceeds the ${VENDOR_CAP_BYTES} byte cap`);
  }
  return { bytes };
}
