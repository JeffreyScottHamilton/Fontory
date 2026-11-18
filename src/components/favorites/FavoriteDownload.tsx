"use client";

import { strToU8, zipSync, type Zippable } from "fflate";
import { useState } from "react";
import type { FontFamily, FontStyle } from "@/lib/types";

interface FavoriteDownloadProps {
  slug: string;
  name: string;
}

type DownloadState =
  | { kind: "idle" }
  | { kind: "fetching" }
  | { kind: "progress"; done: number; total: number }
  | { kind: "error" };

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

// Same archive layout as DownloadButton: <family>/<license>, every style file, README.txt.
async function saveFamilyZip(family: FontFamily, onProgress: (done: number, total: number) => void) {
  const total = family.styles.length + 1; // every style file + the license
  let done = 0;
  const fetchTracked = async (url: string) => {
    const bytes = await fetchBytes(url);
    done += 1;
    onProgress(done, total);
    return bytes;
  };

  const [license, ...files] = await Promise.all([
    fetchTracked(family.licenseUrl),
    ...family.styles.map((s: FontStyle) => fetchTracked(s.url)),
  ]);

  const entries: Zippable = {
    [family.family]: {
      [family.licenseFile]: license,
      ...Object.fromEntries(family.styles.map((s, i) => [s.filename, files[i]])),
      "README.txt": strToU8(
        [
          family.family,
          "",
          `Source: ${family.source.url}`,
          "",
          `The font files in this folder are from Google Fonts. The license in ${family.licenseFile} applies to them.`,
          "",
        ].join("\n"),
      ),
    },
  };

  // Font files barely compress, so store them (level 0) and keep the main thread free.
  const zipped = zipSync(entries, { level: 0 });
  const blob = new Blob([zipped as BlobPart], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${family.family}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function FavoriteDownload({ slug, name }: FavoriteDownloadProps) {
  const [state, setState] = useState<DownloadState>({ kind: "idle" });
  const busy = state.kind === "fetching" || state.kind === "progress";

  async function handleClick() {
    setState({ kind: "fetching" });
    try {
      const response = await fetch(`/api/family/${encodeURIComponent(slug)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const family = (await response.json()) as FontFamily;
      await saveFamilyZip(family, (done, total) => setState({ kind: "progress", done, total }));
      setState({ kind: "idle" });
    } catch {
      setState({ kind: "error" });
    }
  }

  let label = "Download";
  if (state.kind === "fetching") label = "Preparing…";
  if (state.kind === "progress") label = `Preparing ${state.done}/${state.total}…`;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-label={`Download ${name} (.zip)`}
        className="btn btn-secondary"
      >
        {label}
      </button>
      {state.kind === "error" && (
        <p role="alert" className="text-sm text-ink">
          Download failed. Try again.
        </p>
      )}
    </div>
  );
}
