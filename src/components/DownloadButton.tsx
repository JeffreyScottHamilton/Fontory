"use client";

import { strToU8, zipSync, type Zippable } from "fflate";
import { useState } from "react";
import type { FontStyle } from "@/lib/types";

interface DownloadButtonProps {
  family: string;
  slug: string;
  styles: FontStyle[];
  licenseFile: string;
  licenseUrl: string;
  sourceUrl: string;
}

type DownloadState = { kind: "idle" } | { kind: "progress"; done: number; total: number } | { kind: "error" };

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

export default function DownloadButton({
  family,
  styles,
  licenseFile,
  licenseUrl,
  sourceUrl,
}: DownloadButtonProps) {
  const [state, setState] = useState<DownloadState>({ kind: "idle" });
  const busy = state.kind === "progress";

  async function handleClick() {
    const total = styles.length + 1; // every style file + the license
    let done = 0;
    setState({ kind: "progress", done, total });
    try {
      const fetchTracked = async (url: string) => {
        const bytes = await fetchBytes(url);
        done += 1;
        setState({ kind: "progress", done, total });
        return bytes;
      };

      const [license, ...files] = await Promise.all([
        fetchTracked(licenseUrl),
        ...styles.map((s) => fetchTracked(s.url)),
      ]);

      const folder = family;
      const entries: Zippable = {
        [folder]: {
          [licenseFile]: license,
          ...Object.fromEntries(styles.map((s, i) => [s.filename, files[i]])),
          "README.txt": strToU8(
            [
              family,
              "",
              `Source: ${sourceUrl}`,
              "",
              `The font files in this folder are from Google Fonts. The license in ${licenseFile} applies to them.`,
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
      anchor.download = `${family}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState({ kind: "idle" });
    } catch {
      setState({ kind: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center border border-ink bg-ink px-4 py-2.5 text-sm font-medium text-ground hover:opacity-90 disabled:opacity-60"
      >
        {state.kind === "progress" ? `Preparing ${state.done}/${state.total}…` : "Download family (.zip)"}
      </button>
      {state.kind === "error" && (
        <p role="alert" className="text-sm text-accent">
          Download failed — try a single style below.
        </p>
      )}
    </div>
  );
}

export function StyleDownloadLink({ style }: { style: FontStyle }) {
  return (
    <a
      href={style.url}
      download={style.filename}
      className="inline-flex min-h-11 items-center border border-rule px-3 py-1.5 text-sm text-ink hover:border-ink"
    >
      Download {style.weight} {style.style}
    </a>
  );
}
