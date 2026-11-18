// Verifies data/fonts.json against the live hosts (via curl, honouring HTTPS_PROXY) and the vendored
// files under public/, then writes data/verify-report.json. Usage: tsx scripts/import/verify-remote.ts
//
// Checks per family:
//  - preview 'css2': the Google css2 URL returns 200 with @font-face. HTTP 400 is not a failure: the
//    family is recorded in css2Unavailable and build previews it with self-hosted fontface CSS instead.
//  - preview 'fontface': public/fontface/<slug>.css exists.
//  - every style file (and previewUrl): remote https URLs answer 200 to HEAD and their first bytes are a
//    font signature; site-relative (vendored) URLs must exist under public/ and carry a font signature.
//  - license file: remote URL 200, or vendored file exists.
// Failures exclude the family on the next build (build.ts reads failedFamilies).
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cssUrl } from "../../src/lib/google-css";
import type { FontFamily } from "../../src/lib/types";
import { previewFor } from "./weights";

const ROOT = path.resolve(__dirname, "../..");
const DATA_DIR = path.join(ROOT, "data");
const PUBLIC_DIR = path.join(ROOT, "public");
const CONCURRENCY = 12;
const VERIFY_REPORT = path.join(DATA_DIR, "verify-report.json");
const SOURCES_PATH = path.join(__dirname, "sources.json");
const VELVETYNE_PINS_PATH = path.join(__dirname, "sources", "velvetyne-pins.json");
const SOURCES = JSON.parse(readFileSync(SOURCES_PATH, "utf8")) as {
  googleFonts: { commit: string };
  upstreams: { repo: string }[];
};
const SHA = SOURCES.googleFonts.commit;
// Font file magic numbers: TrueType, OpenType CFF, TrueType (Apple 'true'), WOFF2, WOFF.
const FONT_MAGIC = new Set(["00010000", "4f54544f", "74727565", "774f4632", "774f4646"]);
const UPSTREAM_LICENSE_FILES = ["LICENSE", "LICENSE.txt", "OFL.txt", "LICENSE.md"];
const UPSTREAM_BRANCHES = ["main", "master"];

interface UpstreamLicense { repo: string; branch: string | null; file: string | null; firstLine: string | null }
interface PreviousReport {
  pins?: string;
  failedFamilies: { family: string; reason: string }[];
  css2Unavailable?: string[];
}

// Same hash as build.ts: a report only applies to the pins it was verified against.
function pinsHash(): string {
  return createHash("sha256").update(readFileSync(SOURCES_PATH)).update(readFileSync(VELVETYNE_PINS_PATH)).digest("hex");
}

// Every request is HTTPS-only, and "--" ends option parsing so the URL is never read as a flag.
function curl(opts: string[], url: string): Promise<Buffer> {
  const argv = ["-sS", "--proto", "=https", "--retry", "2", "--max-time", "60", ...opts, "--", url];
  return new Promise((resolve, reject) => {
    execFile("curl", argv, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`curl failed: ${String(stderr).trim() || err.message}`));
      else resolve(stdout as Buffer);
    });
  });
}

// GET returning body text and HTTP status.
async function getText(url: string): Promise<{ code: number; body: string }> {
  const out = await curl(["-w", "\n%{http_code}"], url);
  const s = out.toString("utf8");
  const idx = s.lastIndexOf("\n");
  return { code: Number(s.slice(idx + 1)), body: s.slice(0, idx) };
}

// HTTP status of a HEAD request.
async function headStatus(url: string): Promise<number> {
  const out = await curl(["-I", "-o", "/dev/null", "-w", "%{http_code}"], url);
  return Number(out.toString("utf8"));
}

// First 4 bytes via a range request, as hex.
async function magicHex(url: string): Promise<string> {
  const out = await curl(["-r", "0-3", "-o", "-"], url);
  return out.subarray(0, 4).toString("hex");
}

// Runs tasks with a fixed concurrency; results keep input order.
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// Checks one font file URL. Returns a failure message or null.
async function checkFontUrl(url: string): Promise<string | null> {
  if (url.startsWith("/")) {
    const file = path.join(PUBLIC_DIR, url);
    if (!existsSync(file)) return `vendored file missing: ${url}`;
    const hex = readFileSync(file).subarray(0, 4).toString("hex");
    return FONT_MAGIC.has(hex) ? null : `vendored file bytes ${hex}: ${url}`;
  }
  const status = await headStatus(url);
  if (status !== 200) return `HEAD HTTP ${status}: ${url}`;
  const hex = await magicHex(url);
  return FONT_MAGIC.has(hex) ? null : `bytes ${hex}: ${url}`;
}

// Checks a license file URL (remote or vendored). Returns a failure message or null.
async function checkLicense(f: FontFamily): Promise<string | null> {
  if (f.licenseUrl.startsWith("/")) {
    return existsSync(path.join(PUBLIC_DIR, f.licenseUrl)) ? null : `license ${f.licenseFile} missing: ${f.licenseUrl}`;
  }
  const status = await headStatus(f.licenseUrl);
  return status === 200 ? null : `license ${f.licenseFile} HTTP ${status}`;
}

async function checkUpstream(repo: string): Promise<UpstreamLicense> {
  for (const branch of UPSTREAM_BRANCHES) {
    for (const file of UPSTREAM_LICENSE_FILES) {
      const url = `https://raw.githubusercontent.com/${repo}/${branch}/${file}`;
      const { code, body } = await getText(url);
      if (code !== 200) continue;
      const firstLine = body.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? null;
      if (firstLine === null) continue;
      return { repo, branch, file, firstLine: firstLine.slice(0, 200) };
    }
  }
  return { repo, branch: null, file: null, firstLine: null };
}

async function main(): Promise<void> {
  const families = JSON.parse(readFileSync(path.join(DATA_DIR, "fonts.json"), "utf8")) as FontFamily[];
  const css2Checked = new Set(families.filter((f) => f.preview === "css2").map((f) => f.family));
  const css2Refused = new Set<string>();

  // One task per check; each returns a failure message or null.
  interface Task { family: string; run: () => Promise<string | null> }
  const tasks: Task[] = [];
  let stylesChecked = 0;
  for (const f of families) {
    if (f.preview === "css2") {
      const preview = previewFor(f);
      tasks.push({
        family: f.family,
        run: async () => {
          const { code, body } = await getText(cssUrl(f.family, [{ weight: preview.previewWeight, style: preview.previewStyle }]));
          if (code === 400) {
            css2Refused.add(f.family);
            return null;
          }
          if (code !== 200) return `css2 preview HTTP ${code}`;
          if (!body.includes("@font-face")) return "css2 preview has no @font-face";
          return null;
        },
      });
    } else {
      tasks.push({
        family: f.family,
        run: async () => (existsSync(path.join(PUBLIC_DIR, "fontface", `${f.slug}.css`)) ? null : `fontface sheet missing: /fontface/${f.slug}.css`),
      });
    }
    for (const s of f.styles) {
      stylesChecked++;
      for (const url of [s.url, s.previewUrl].filter((u): u is string => Boolean(u))) {
        tasks.push({
          family: f.family,
          run: async () => {
            const msg = await checkFontUrl(url);
            return msg === null ? null : `style ${s.style} ${s.weight} (${s.filename}) ${msg}`;
          },
        });
      }
    }
    tasks.push({ family: f.family, run: () => checkLicense(f) });
  }

  const failures = new Map<string, string[]>();
  let done = 0;
  await pool(tasks, CONCURRENCY, async (t) => {
    let msg: string | null;
    try {
      msg = await t.run();
    } catch (e) {
      msg = `request error: ${(e as Error).message}`;
    }
    if (msg !== null) {
      const list = failures.get(t.family) ?? [];
      list.push(msg);
      failures.set(t.family, list);
    }
    done++;
    if (done % 2000 === 0) console.log(`verify progress ${done}/${tasks.length}`);
  });

  // Families already excluded by an earlier verify are absent from fonts.json, so they are not
  // re-checked here. Carry their failures forward (same pins only) so the next build keeps them
  // excluded. To re-verify everything, delete data/verify-report.json and rebuild first.
  const pins = pinsHash();
  const checked = new Set(families.map((f) => f.family));
  const previous = existsSync(VERIFY_REPORT)
    ? (JSON.parse(readFileSync(VERIFY_REPORT, "utf8")) as PreviousReport)
    : null;
  const samePins = previous !== null && previous.pins === pins;
  const carried = samePins
    ? previous.failedFamilies.filter((f) => !checked.has(f.family) && !failures.has(f.family))
    : [];
  // css2 refusals stay recorded for families whose css2 preview is not re-checked this run.
  const css2Carried = samePins ? (previous.css2Unavailable ?? []).filter((name) => !css2Checked.has(name)) : [];
  const css2Unavailable = [...new Set([...css2Refused, ...css2Carried])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const failedFamilies = [
    ...[...failures.entries()].map(([family, reasons]) => ({ family, reason: reasons.join("; ") })),
    ...carried,
  ].sort((a, b) => (a.family < b.family ? -1 : a.family > b.family ? 1 : 0));

  const upstreamLicenses = await pool(SOURCES.upstreams.map((u) => u.repo), CONCURRENCY, checkUpstream);

  const knownLimitations = css2Unavailable.length
    ? [{
        id: "css2-preview-http-400",
        count: css2Unavailable.length,
        families: css2Unavailable,
        note: `Google css2 API returns HTTP 400 for the preview of these families. They are previewed from self-hosted /fontface/<slug>.css built from the raw TTF files (preview 'fontface').`,
      }]
    : [];
  const report = {
    checkedAt: new Date().toISOString(),
    commit: SHA,
    pins,
    families: families.length,
    stylesChecked,
    failedFamilies,
    css2Unavailable,
    upstreamLicenses,
    knownLimitations,
  };
  writeFileSync(VERIFY_REPORT, JSON.stringify(report, null, 2) + "\n");
  console.log(`VERIFY: families=${families.length} styles=${stylesChecked} checks=${tasks.length} failed=${failedFamilies.length} css2Unavailable=${css2Unavailable.length}`);
  if (carried.length) console.log(`VERIFY: carried ${carried.length} failure(s) from previous run for families not re-checked`);
  for (const f of failedFamilies.slice(0, 20)) console.log(`  FAILED ${f.family}: ${f.reason}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
