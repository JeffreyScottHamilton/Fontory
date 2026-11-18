"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useId, useState } from "react";
import { COMPARE_SAMPLE, WATERFALL_SAMPLE, WATERFALL_SIZES } from "@/components/compare/constants";
import { useFontReady } from "@/lib/useFontStylesheet";
import { CATEGORIES, type FontIndexEntry } from "@/lib/types";

const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.id, c.label]));

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 text-ink"
    >
      <path d="M2 4.25 6 8l4-3.75" />
    </svg>
  );
}

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

  const status = useFontReady(entry, weight, style, true);
  const ready = status === "ready";
  const sample = text.trim() === "" ? COMPARE_SAMPLE : text;
  const categories = entry.categories.map((c) => CATEGORY_LABEL.get(c) ?? c).join(" · ");
  const styleCount = `${entry.styleCount} ${entry.styleCount === 1 ? "style" : "styles"}`;

  // Only ever rendered in the family's own face: hidden (not fallback) until it is ready.
  const face = (fontSize: number, lineHeight: number): CSSProperties => ({
    fontFamily: `'${entry.family}', system-ui`,
    fontWeight: weight,
    fontStyle: style,
    fontSize,
    lineHeight,
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 className="min-w-0 [overflow-wrap:anywhere]">
          <Link
            href={`/font/${entry.slug}`}
            className="text-[clamp(2.5rem,5vw,4rem)] leading-[1.02] tracking-[-0.025em] text-ink underline-offset-[6px] hover:underline"
            style={{ fontFamily: `'${entry.family}', system-ui`, fontWeight: weight, fontStyle: style, color: ready ? undefined : "transparent" }}
          >
            {entry.family}
          </Link>
        </h2>
        <p className="label-mono">
          {entry.designer} · {styleCount}
          {categories ? ` · ${categories}` : null}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-4 border-y border-rule py-4">
        <div className="flex min-w-[8rem] flex-col gap-1">
          <label htmlFor={weightId} className="label-mono">
            Weight
          </label>
          <div className="relative">
            <select
              id={weightId}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="field pr-8 tabular-nums"
            >
              {entry.weights.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <ChevronIcon />
          </div>
        </div>
        {entry.hasItalic && (
          <label htmlFor={italicId} className="flex min-h-11 items-center gap-3 text-sm text-ink">
            <input
              id={italicId}
              type="checkbox"
              checked={italic}
              onChange={(e) => setItalic(e.target.checked)}
              className="h-4 w-4 accent-ink"
            />
            Italic
          </label>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p
          className="overflow-hidden text-ink [overflow-wrap:anywhere]"
          style={{
            ...face(size, 1.1),
            minHeight: Math.ceil(size * 1.1),
            visibility: ready ? "visible" : "hidden",
          }}
        >
          {sample}
        </p>
        {status === "loading" && <p className="label-mono">Loading font…</p>}
        {status === "error" && <p className="label-mono">Preview unavailable for this weight and style.</p>}
      </div>

      <ul className="flex flex-col border-b border-rule">
        {WATERFALL_SIZES.map((px) => (
          <li
            key={px}
            className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-baseline gap-4 border-t border-rule py-3"
          >
            <span className="label-mono tabular-nums">{px}px</span>
            <p
              className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink"
              style={{ ...face(px, 1.25), visibility: ready ? "visible" : "hidden" }}
            >
              {WATERFALL_SAMPLE}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
