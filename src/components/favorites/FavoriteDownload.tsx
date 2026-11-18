"use client";

import { useState } from "react";
import { buildFamilyZip, saveFamilyZip } from "@/lib/family-zip";
import type { FontFamily } from "@/lib/types";

interface FavoriteDownloadProps {
  slug: string;
  name: string;
}

type DownloadState =
  | { kind: "idle" }
  | { kind: "fetching" }
  | { kind: "progress"; done: number; total: number }
  | { kind: "error" };

export default function FavoriteDownload({ slug, name }: FavoriteDownloadProps) {
  const [state, setState] = useState<DownloadState>({ kind: "idle" });
  const busy = state.kind === "fetching" || state.kind === "progress";

  async function handleClick() {
    setState({ kind: "fetching" });
    try {
      const response = await fetch(`/api/family/${encodeURIComponent(slug)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const family = (await response.json()) as FontFamily;
      const zipped = await buildFamilyZip(family, (done, total) => setState({ kind: "progress", done, total }));
      saveFamilyZip(family.family, zipped);
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
