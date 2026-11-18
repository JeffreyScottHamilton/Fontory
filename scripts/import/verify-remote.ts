// Verifies data/fonts.json against the live hosts (via curl, honouring HTTPS_PROXY) and writes
// data/verify-report.json. Usage: tsx scripts/import/verify-remote.ts
import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cssUrl } from "../../src/lib/google-css";
import type { FontFamily } from "../../src/lib/types";
import { previewFor } from "./weights";

const ROOT = path.resolve(__dirname, "../..");
const DATA_DIR = path.join(ROOT, "data");
const CONCURRENCY = 12;
const VERIFY_REPORT = path.join(DATA_DIR, "verify-report.json");
const SHA = JSON.parse(readFileSync(path.join(__dirname, "sources.json"), "utf8")).googleFonts.commit as string;
interface PreviousReport { commit?: string; failedFamilies: { family: string; reason: string }[] }
const SOURCES = JSON.parse(readFileSync(path.join(__dirname, "sources.json"), "utf8")) as {
  googleFonts: { commit: string };
  upstreams: { repo: string }[];
};
// Font file magic numbers: TrueType, OpenType CFF, TrueType (Apple 'true').
const FONT_MAGIC = new Set(["00010000", "4f54544f", "74727565"]);
const UPSTREAM_LICENSE_FILES = ["LICENSE", "LICENSE.txt", "OFL.txt", "LICENSE.md"];
const UPSTREAM_BRANCHES = ["main", "master"];

interface UpstreamLicense { repo: string; branch: string | null; file: string | null; firstLine: string | null }

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

// First 4 bytes via a range request; returns hex of what was received.
async function magicHex(url: string): Promise<string> {
  const out = await curl(["-r", "0-3", "-o", "-"], url);
  return out.subarray(0, 4).toString("hex");
}

async function statusOf(url: string): Promise<number> {
  const out = await curl(["-o", "/dev/null", "-w", "%{http_code}"], url);
  return Number(out.toString("utf8"));
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

  // One task per check; each returns a failure message or null.
  interface Task { family: string; run: () => Promise<string | null> }
  const tasks: Task[] = [];
  let stylesChecked = 0;
  for (const f of families) {
    const preview = previewFor(f);
    tasks.push({
      family: f.family,
      run: async () => {
        const { code, body } = await getText(cssUrl(f.family, [{ weight: preview.previewWeight, style: preview.previewStyle }]));
        if (code !== 200) return `css2 preview HTTP ${code}`;
        if (!body.includes("@font-face")) return "css2 preview has no @font-face";
        return null;
      },
    });
    for (const s of f.styles) {
      stylesChecked++;
      tasks.push({
        family: f.family,
        run: async () => {
          const hex = await magicHex(s.url);
          if (FONT_MAGIC.has(hex)) return null;
          return `style ${s.style} ${s.weight} (${s.filename}) bytes ${hex}`;
        },
      });
    }
    tasks.push({
      family: f.family,
      run: async () => {
        const code = await statusOf(f.licenseUrl);
        return code === 200 ? null : `license ${f.licenseFile} HTTP ${code}`;
      },
    });
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
  // re-checked here. Carry their failures forward (same pinned commit only) so the next build
  // keeps them excluded. To re-verify everything, delete data/verify-report.json and rebuild first.
  const checked = new Set(families.map((f) => f.family));
  const previous = existsSync(VERIFY_REPORT)
    ? (JSON.parse(readFileSync(VERIFY_REPORT, "utf8")) as PreviousReport)
    : null;
  const carried = previous && previous.commit === SHA
    ? previous.failedFamilies.filter((f) => !checked.has(f.family) && !failures.has(f.family))
    : [];
  const failedFamilies = [
    ...[...failures.entries()].map(([family, reasons]) => ({ family, reason: reasons.join("; ") })),
    ...carried,
  ].sort((a, b) => (a.family < b.family ? -1 : a.family > b.family ? 1 : 0));

  const upstreamLicenses = await pool(SOURCES.upstreams.map((u) => u.repo), CONCURRENCY, checkUpstream);

  const css400 = failedFamilies.filter((f) => f.reason.includes("css2 preview HTTP 400")).map((f) => f.family);
  const knownLimitations = css400.length
    ? [{
        id: "css2-preview-http-400",
        count: css400.length,
        families: css400,
        note: "Google css2 API returns HTTP 400 for the preview request of these families, so they are excluded from the library. Kept as a known limitation.",
      }]
    : [];
  const report = {
    checkedAt: new Date().toISOString(),
    commit: SHA,
    families: families.length,
    stylesChecked,
    failedFamilies,
    upstreamLicenses,
    knownLimitations,
  };
  writeFileSync(path.join(DATA_DIR, "verify-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`VERIFY: families=${families.length} styles=${stylesChecked} failed=${failedFamilies.length}`);
  if (carried.length) console.log(`VERIFY: carried ${carried.length} failure(s) from previous run for families not re-checked`);
  for (const f of failedFamilies.slice(0, 20)) console.log(`  FAILED ${f.family}: ${f.reason}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
