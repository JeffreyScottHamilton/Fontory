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
  | { kind: "done" }
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
      setState({ kind: "done" });
    } catch {
      setState({ kind: "error" });
    }
  }

  let label = "Download";
  if (state.kind === "fetching") label = "Preparing…";
  if (state.kind === "progress") label = `Preparing ${state.done}/${state.total}…`;

  // The family name is not in the visible label, so it is announced with the button as sr-only text.
  // Progress and completion go to the polite live region below.
  let announcement = "";
  if (state.kind === "fetching") announcement = `Preparing ${name} (.zip)…`;
  if (state.kind === "progress") announcement = `Preparing ${name} (.zip), ${state.done} of ${state.total}…`;
  if (state.kind === "done") announcement = `${name} (.zip) downloaded.`;

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={handleClick} disabled={busy} className="btn btn-secondary">
        {label}
        <span className="sr-only"> {name} (.zip)</span>
      </button>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {state.kind === "error" && (
        <p role="alert" className="text-sm text-ink">
          Download failed. Try again.
        </p>
      )}
    </div>
  );
}
