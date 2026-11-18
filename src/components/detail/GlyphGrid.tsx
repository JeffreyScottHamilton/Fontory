"use client";

import { useState } from "react";
import { codePointLabel, type GlyphRow } from "@/components/detail/format";
import { useFontReady } from "@/lib/useFontStylesheet";

interface GlyphGridProps {
  family: string;
  weight: number;
  style: "normal" | "italic";
  rows: GlyphRow[];
}

/**
 * Glyph cells in the family's preview style. Each glyph is a button: hovering, clicking or
 * tabbing to one shows it large in the inspector. Glyph text stays hidden until the face is ready.
 */
export default function GlyphGrid({ family, weight, style, rows }: GlyphGridProps) {
  const status = useFontReady(family, weight, style, true);
  const visibility = status === "ready" ? "visible" : "hidden";
  const [selected, setSelected] = useState(() => rows[0]?.glyphs[0] ?? "");
  const face = { fontFamily: `'${family}', system-ui`, fontWeight: weight, fontStyle: style };

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
                return (
                  <li key={glyph} className="min-w-0">
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`${glyph} ${codePointLabel(glyph)}`}
                      onClick={() => setSelected(glyph)}
                      onFocus={() => setSelected(glyph)}
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
