"use client";

import { useState } from "react";
import { buildFamilyZip, saveFamilyZip } from "@/lib/family-zip";
import type { FontStyle } from "@/lib/types";

interface DownloadButtonProps {
  family: string;
  slug: string;
  styles: FontStyle[];
  licenseFile: string;
  licenseUrl: string;
  licenseName?: string;
  sourceUrl: string;
  sourceRepo?: string;
}

type DownloadState = { kind: "idle" } | { kind: "progress"; done: number; total: number } | { kind: "error" };

export default function DownloadButton({
  family,
  styles,
  licenseFile,
  licenseUrl,
  licenseName,
  sourceUrl,
  sourceRepo,
}: DownloadButtonProps) {
  const [state, setState] = useState<DownloadState>({ kind: "idle" });
  const busy = state.kind === "progress";

  async function handleClick() {
    setState({ kind: "progress", done: 0, total: styles.length + 1 });
    try {
      const zipped = await buildFamilyZip(
        { family, licenseFile, licenseUrl, licenseName, styles, source: { url: sourceUrl, repo: sourceRepo } },
        (done, total) => setState({ kind: "progress", done, total }),
      );
      saveFamilyZip(family, zipped);
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
        className="btn btn-primary"
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
      className="btn btn-secondary"
    >
      Download {style.weight} {style.style}
    </a>
  );
}
