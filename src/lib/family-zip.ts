import { strToU8, zipSync, type Zippable } from "fflate";
import type { FontFamily } from "@/lib/types";

// The fields the archive needs. A full FontFamily satisfies this, and so does a caller
// that only has the individual values. licenseName and source.repo are optional so older
// callers still compile; the README is simply less specific without them.
export type FamilyZipSource = Pick<FontFamily, "family" | "licenseFile" | "licenseUrl" | "styles"> & {
  licenseName?: string;
  source: Pick<FontFamily["source"], "url"> & { repo?: string };
};

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

// README.txt: family name, the real source repository and URL, the license name and file.
export function familyReadme(family: FamilyZipSource): string {
  const lines = [family.family, ""];
  if (family.source.repo) lines.push(`Source repository: ${family.source.repo}`);
  lines.push(`Source: ${family.source.url}`);
  if (family.licenseName) lines.push(`License: ${family.licenseName} (${family.licenseFile})`);
  lines.push(
    "",
    `The font files in this folder are from ${family.source.repo ?? "the source above"}. The license in ${family.licenseFile} applies to them.`,
    "",
  );
  return lines.join("\n");
}

// Archive layout: <family>/<license>, every style file, README.txt.
// Pure: takes the already-fetched license and style bytes (styles in family.styles order).
export function buildZipEntries(
  family: FamilyZipSource,
  license: Uint8Array,
  files: Uint8Array[],
): Zippable {
  return {
    [family.family]: {
      [family.licenseFile]: license,
      ...Object.fromEntries(family.styles.map((s, i) => [s.filename, files[i]])),
      "README.txt": strToU8(familyReadme(family)),
    },
  };
}

/**
 * Fetches the license and every style file and returns the family zip.
 * onProgress is called after each file arrives with (done, total), total = styles + license.
 */
export async function buildFamilyZip(
  family: FamilyZipSource,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const total = family.styles.length + 1; // every style file + the license
  let done = 0;
  const fetchTracked = async (url: string) => {
    const bytes = await fetchBytes(url);
    done += 1;
    onProgress?.(done, total);
    return bytes;
  };

  const [license, ...files] = await Promise.all([
    fetchTracked(family.licenseUrl),
    ...family.styles.map((s) => fetchTracked(s.url)),
  ]);

  // Font files barely compress, so store them (level 0) and keep the main thread free.
  return zipSync(buildZipEntries(family, license, files), { level: 0 });
}

// Triggers a browser download of the zip bytes as `${family}.zip`.
export function saveFamilyZip(family: string, zipped: Uint8Array): void {
  const blob = new Blob([zipped as BlobPart], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${family}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
