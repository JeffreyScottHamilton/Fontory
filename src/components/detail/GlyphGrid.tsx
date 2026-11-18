"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { codePointLabel, type GlyphRow } from "@/components/detail/format";
import { previewHref } from "@/lib/preview-css";
import type { FontStyle } from "@/lib/types";
import { useFontReady, useFontStylesheet, type ReadyFont } from "@/lib/useFontStylesheet";

interface GlyphGridProps {
  font: ReadyFont;
  weight: number;
  style: "normal" | "italic";
  rows: GlyphRow[];
  /** The family's styles. Used to share the combined stylesheet that DetailPreview and FamilyName load. */
  styles?: FontStyle[];
}

/**
 * Glyph cells in the family's preview style. Clicking or focusing a glyph shows it large in the
 * inspector. The grid is one tab stop (roving tabindex on the selected glyph); the arrow keys,
 * Home and End move between glyphs. Glyph text stays hidden until the face is ready.
 */
export default function GlyphGrid({ font, weight, style, rows, styles }: GlyphGridProps) {
  const { family } = font;
  // Same href as DetailPreview and FamilyName, so the stylesheet is injected once. Without styles, the hook falls back to its own per-face sheet.
  const sheet = useFontStylesheet(styles ? previewHref(font, styles) : null);
  const status = useFontReady(font, weight, style, true, styles ? { sheet } : undefined);
  const visibility = status === "ready" ? "visible" : "hidden";
  const [selected, setSelected] = useState(() => rows[0]?.glyphs[0] ?? "");
  const face = { fontFamily: `'${family}', system-ui`, fontWeight: weight, fontStyle: style };

  const flat = useMemo(() => rows.flatMap((row) => row.glyphs), [rows]);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  // The selected glyph is the tab stop; if it is no longer in the rows, the first glyph is.
  const tabStop = flat.includes(selected) ? selected : (flat[0] ?? "");

  function focusGlyph(index: number) {
    const glyph = flat[index];
    if (glyph === undefined) return;
    setSelected(glyph);
    buttons.current.get(glyph)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null;
    switch (event.key) {
      case "ArrowLeft":
        next = index - 1;
        break;
      case "ArrowRight":
        next = index + 1;
        break;
      case "ArrowUp":
      case "ArrowDown": {
        // Columns come from the rendered row grid, so the step follows the responsive breakpoint.
        const list = event.currentTarget.closest("ul");
        const columns = list ? getComputedStyle(list).gridTemplateColumns.split(" ").filter(Boolean).length : 1;
        next = event.key === "ArrowUp" ? index - columns : index + columns;
        break;
      }
      case "Home":
        next = 0;
        break;
      case "End":
        next = flat.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next === null || next < 0 || next >= flat.length) return;
    focusGlyph(next);
  }

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_16rem] md:items-start md:gap-10">
      <div className="flex flex-col gap-3 md:sticky md:top-24 md:col-start-2 md:row-start-1 md:self-start">
        <div className="flex h-56 items-center justify-center border border-rule md:aspect-square md:h-auto">
          <span className="text-[8rem] leading-none text-ink md:text-[10rem]" style={{ ...face, visibility }}>
            {selected}
          </span>
        </div>
        <p className="label-mono tabular-nums text-ink">{selected ? codePointLabel(selected) : ""}</p>
      </div>

      <div className="flex min-w-0 flex-col gap-8 md:col-start-1 md:row-start-1">
        {rows.map((row) => (
          <div key={row.id}>
            <h3 className="label-mono mb-3">{row.label}</h3>
            <ul className="grid grid-cols-6 border-l border-t border-rule sm:grid-cols-10 md:grid-cols-12">
              {row.glyphs.map((glyph) => {
                const on = glyph === selected;
                const index = flat.indexOf(glyph);
                return (
                  <li key={glyph} className="min-w-0">
                    <button
                      ref={(el) => {
                        if (el) buttons.current.set(glyph, el);
                        else buttons.current.delete(glyph);
                      }}
                      type="button"
                      tabIndex={glyph === tabStop ? 0 : -1}
                      aria-pressed={on}
                      aria-label={`${glyph} ${codePointLabel(glyph)}`}
                      onClick={() => setSelected(glyph)}
                      onFocus={() => setSelected(glyph)}
                      onKeyDown={(event) => onKeyDown(event, index)}
                      className={`flex aspect-square w-full items-center justify-center overflow-hidden border-b border-r border-rule text-ink transition-colors duration-150 ${
                        on ? "bg-ink text-ground" : "hover:bg-ground-2"
                      }`}
                    >
                      <span className="text-xl leading-none sm:text-2xl" style={{ ...face, visibility }}>
                        {glyph}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {status === "loading" && <p className="text-xs text-muted">Loading font…</p>}
        {status === "error" && <p className="text-xs text-muted">Preview unavailable</p>}
      </div>
    </div>
  );
}
