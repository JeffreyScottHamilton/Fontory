"use client";

import { useFontReady } from "@/lib/useFontStylesheet";
import type { GlyphRow } from "@/components/detail/format";

interface GlyphGridProps {
  family: string;
  weight: number;
  style: "normal" | "italic";
  rows: GlyphRow[];
}

/** Glyph cells in the family's preview style. Glyph text stays hidden until the face is ready. */
export default function GlyphGrid({ family, weight, style, rows }: GlyphGridProps) {
  const status = useFontReady(family, weight, style, true);
  const visibility = status === "ready" ? "visible" : "hidden";

  return (
    <div className="flex flex-col gap-8">
      {rows.map((row) => (
        <div key={row.id}>
          <h3 className="mb-2 text-sm text-muted">{row.label}</h3>
          <ul className="grid grid-cols-6 border-l border-t border-rule sm:grid-cols-10 md:grid-cols-12">
            {row.glyphs.map((glyph) => (
              <li
                key={glyph}
                className="flex aspect-square items-center justify-center overflow-hidden border-b border-r border-rule text-ink"
              >
                <span
                  className="text-xl leading-none sm:text-2xl"
                  style={{
                    fontFamily: `'${family}', system-ui`,
                    fontWeight: weight,
                    fontStyle: style,
                    visibility,
                  }}
                >
                  {glyph}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {status === "loading" && <p className="text-xs text-muted">Loading font…</p>}
      {status === "error" && <p className="text-xs text-muted">Preview unavailable</p>}
    </div>
  );
}
