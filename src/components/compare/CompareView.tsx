"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useId, useMemo } from "react";
import FontPicker from "@/components/compare/FontPicker";
import SelectedFont from "@/components/compare/SelectedFont";
import { COMPARE_SAMPLE } from "@/components/compare/constants";
import { MAX_SIZE, MIN_SIZE, usePreview } from "@/lib/preview";
import type { FontIndexEntry } from "@/lib/types";

const INPUT_CLASS = "w-full border border-rule bg-ground px-3 py-2 text-base text-ink placeholder:text-muted";

interface CompareViewProps {
  index: FontIndexEntry[];
}

export default function CompareView({ index }: CompareViewProps) {
  const params = useSearchParams();
  const router = useRouter();
  const [preview, setText, setSize] = usePreview();
  const textId = useId();
  const sizeId = useId();

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
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-end">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={textId} className="text-sm text-muted">
            Preview text
          </label>
          <textarea
            id={textId}
            rows={2}
            value={preview.text}
            placeholder={COMPARE_SAMPLE}
            onChange={(e) => setText(e.target.value)}
            className={`${INPUT_CLASS} resize-y`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between text-sm text-muted">
            <label htmlFor={sizeId}>Size</label>
            <output htmlFor={sizeId} className="tabular-nums text-ink">
              {preview.size}px
            </output>
          </div>
          <input
            id={sizeId}
            type="range"
            min={MIN_SIZE}
            max={MAX_SIZE}
            step={1}
            value={preview.size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-full accent-ink"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!aSlug && !bSlug}
          onClick={() => go(bSlug, aSlug)}
          className="inline-flex min-h-11 items-center border border-rule px-4 text-sm text-ink hover:border-ink disabled:opacity-50"
        >
          Swap
        </button>
      </div>

      <div className="grid gap-10 md:grid-cols-2 md:gap-8">
        <section aria-label="Font A" className="flex min-w-0 flex-col gap-6">
          <FontPicker label="Font A" index={index} onPick={(slug) => go(slug, bSlug)} />
          {a ? <SelectedFont key={a.slug} entry={a} text={preview.text} size={preview.size} /> : <EmptySide />}
        </section>

        <section aria-label="Font B" className="flex min-w-0 flex-col gap-6 md:border-l md:border-rule md:pl-8">
          <FontPicker label="Font B" index={index} onPick={(slug) => go(aSlug, slug)} />
          {b ? <SelectedFont key={b.slug} entry={b} text={preview.text} size={preview.size} /> : <EmptySide />}
        </section>
      </div>
    </div>
  );
}

function EmptySide() {
  return <p className="border-t border-rule pt-6 text-sm text-muted">Choose a font to compare.</p>;
}
