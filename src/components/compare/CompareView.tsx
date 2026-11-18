"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import FontPicker from "@/components/compare/FontPicker";
import SelectedFont from "@/components/compare/SelectedFont";
import PreviewControls from "@/components/PreviewControls";
import { usePreview } from "@/lib/preview";
import type { FontIndexEntry } from "@/lib/types";

interface CompareViewProps {
  index: FontIndexEntry[];
}

export default function CompareView({ index }: CompareViewProps) {
  const params = useSearchParams();
  const router = useRouter();
  const [preview] = usePreview();

  const aSlug = params.get("a") ?? "";
  const bSlug = params.get("b") ?? "";
  const bySlug = useMemo(() => new Map(index.map((entry) => [entry.slug, entry])), [index]);
  const a = bySlug.get(aSlug);
  const b = bySlug.get(bSlug);

  const go = useCallback(
    (nextA: string, nextB: string) => {
      const query = new URLSearchParams();
      if (nextA) query.set("a", nextA);
      if (nextB) query.set("b", nextB);
      const qs = query.toString();
      router.replace(qs ? `/compare?${qs}` : "/compare", { scroll: false });
    },
    [router],
  );

  return (
    <div className="flex flex-col">
      <header className="flex items-end justify-between gap-6 pb-8 md:pb-10">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="font-display text-[clamp(3.5rem,9vw,6.5rem)] leading-[0.95] font-normal tracking-[-0.035em] text-ink">
            Compare
          </h1>
          <p className="max-w-[52ch] text-base leading-relaxed text-muted">
            Set two faces side by side with the same text.
          </p>
        </div>
        <button
          type="button"
          disabled={!a && !b}
          onClick={() => go(bSlug, aSlug)}
          className="btn btn-secondary shrink-0"
        >
          Swap
        </button>
      </header>

      {/* Shared controls. Solid ground and a hairline keep the columns readable while scrolling. */}
      <div className="sticky top-16 z-30 -mx-4 border-b border-rule bg-ground px-4 py-3 md:-mx-8 md:px-8 xl:-mx-12 xl:px-12">
        <PreviewControls compact />
      </div>

      <div className="grid md:grid-cols-2">
        <section aria-label="Font A" className="flex min-w-0 flex-col gap-8 pt-8 md:border-r md:border-rule md:pt-10 md:pr-8">
          <FontPicker label="Font A" index={index} onPick={(slug) => go(slug, bSlug)} />
          {a ? <SelectedFont key={a.slug} entry={a} text={preview.text} size={preview.size} /> : <EmptySide slug={aSlug} />}
        </section>

        <section
          aria-label="Font B"
          className="mt-12 flex min-w-0 flex-col gap-8 border-t border-rule pt-8 md:mt-0 md:border-t-0 md:pt-10 md:pl-8"
        >
          <FontPicker label="Font B" index={index} onPick={(slug) => go(aSlug, slug)} />
          {b ? <SelectedFont key={b.slug} entry={b} text={preview.text} size={preview.size} /> : <EmptySide slug={bSlug} />}
        </section>
      </div>
    </div>
  );
}

/** Shown in a column with no resolved font. An unknown slug from the URL gets its own line. */
function EmptySide({ slug }: { slug: string }) {
  if (slug) return <p className="text-[15px] text-muted">No font named “{slug}”.</p>;
  return <p className="text-[15px] text-muted">Choose a font to compare.</p>;
}
