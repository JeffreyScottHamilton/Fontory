"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { COMPARE_SAMPLE } from "@/components/compare/constants";
import { useFontReady } from "@/lib/useFontStylesheet";
import { CATEGORIES, type FontIndexEntry } from "@/lib/types";

const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.id, c.label]));

interface SelectedFontProps {
  entry: FontIndexEntry;
  text: string;
  size: number;
}

// Keyed by slug at the call site, so the weight and style reset when the font changes.
export default function SelectedFont({ entry, text, size }: SelectedFontProps) {
  const weightId = useId();
  const italicId = useId();
  const [weight, setWeight] = useState(entry.previewWeight);
  const [italic, setItalic] = useState(entry.previewStyle === "italic");
  const style = entry.hasItalic && italic ? "italic" : "normal";

  const status = useFontReady(entry.family, weight, style, true);
  const ready = status === "ready";
  const sample = text.trim() === "" ? COMPARE_SAMPLE : text;
  const categories = entry.categories.map((c) => CATEGORY_LABEL.get(c) ?? c).join(", ");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-ink">
          <Link href={`/font/${entry.slug}`} className="underline-offset-4 hover:underline">
            {entry.family}
          </Link>
        </h2>
        <p className="text-sm text-muted">
          {entry.designer} · {entry.styleCount} {entry.styleCount === 1 ? "style" : "styles"}
          {categories ? ` · ${categories}` : null}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={weightId} className="text-sm text-muted">
            Weight
          </label>
          <select
            id={weightId}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="h-11 border border-rule bg-ground px-3 text-base text-ink"
          >
            {entry.weights.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
        {entry.hasItalic && (
          <div className="flex min-h-11 items-center gap-2">
            <input
              id={italicId}
              type="checkbox"
              checked={italic}
              onChange={(e) => setItalic(e.target.checked)}
              className="h-5 w-5 accent-ink"
            />
            <label htmlFor={italicId} className="text-sm text-ink">
              Italic
            </label>
          </div>
        )}
      </div>

      <p
        className="overflow-hidden text-ink [overflow-wrap:anywhere]"
        style={{
          fontFamily: `'${entry.family}', system-ui`,
          fontWeight: weight,
          fontStyle: style,
          fontSize: size,
          minHeight: Math.ceil(size * 1.3),
          visibility: ready ? "visible" : "hidden",
        }}
      >
        {sample}
      </p>
      {status === "loading" && <p className="text-xs text-muted">Loading font…</p>}
      {status === "error" && <p className="text-xs text-muted">Preview unavailable for this weight and style.</p>}
    </div>
  );
}
