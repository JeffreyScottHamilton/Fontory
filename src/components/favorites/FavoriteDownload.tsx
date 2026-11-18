"use client";

import { useState } from "react";
import DownloadButton from "@/components/DownloadButton";
import type { FontFamily } from "@/lib/types";

interface FavoriteDownloadProps {
  slug: string;
  name: string;
}

type PrepareState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; family: FontFamily }
  | { kind: "error" };

export default function FavoriteDownload({ slug, name }: FavoriteDownloadProps) {
  const [state, setState] = useState<PrepareState>({ kind: "idle" });

  async function prepare() {
    setState({ kind: "loading" });
    try {
      const response = await fetch(`/api/family/${encodeURIComponent(slug)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const family = (await response.json()) as FontFamily;
      setState({ kind: "ready", family });
    } catch {
      setState({ kind: "error" });
    }
  }

  if (state.kind === "ready") {
    const { family } = state;
    return (
      <DownloadButton
        family={family.family}
        slug={family.slug}
        styles={family.styles}
        licenseFile={family.licenseFile}
        licenseUrl={family.licenseUrl}
        sourceUrl={family.source.url}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={prepare}
        disabled={state.kind === "loading"}
        aria-label={`Prepare download for ${name}`}
        className="inline-flex min-h-11 items-center justify-center border border-rule px-4 py-2 text-sm text-ink hover:border-ink disabled:opacity-60"
      >
        {state.kind === "loading" ? "Preparing…" : "Prepare download"}
      </button>
      {state.kind === "error" && (
        <p role="alert" className="text-sm text-ink">
          Could not prepare this download. Try again.
        </p>
      )}
    </div>
  );
}
