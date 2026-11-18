"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import FavoriteButton from "@/components/FavoriteButton";
import { DEFAULT_SAMPLE } from "@/lib/preview";
import { useFontReady } from "@/lib/useFontStylesheet";
import { CATEGORIES, type FontIndexEntry } from "@/lib/types";

const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.id, c.label]));

export type FontCardView = "grid" | "list";

interface FontCardProps {
  font: FontIndexEntry;
  text: string;
  size: number;
  /** grid (default) is a specimen cell; list is one full-width row. */
  view?: FontCardView;
}

export default function FontCard({ font, text, size, view = "grid" }: FontCardProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  // Load the stylesheet only once the card is near the viewport.
  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // Old browsers: load without waiting for visibility.
      const timeout = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(timeout);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  const status = useFontReady(font.family, font.previewWeight, font.previewStyle, visible);
  const ready = status === "ready";
  const list = view === "list";

  const sample = text.trim() === "" ? DEFAULT_SAMPLE : text;
  const categories = font.categories.map((c) => CATEGORY_LABEL.get(c) ?? c).join(" · ");
  const meta = [
    font.designer,
    `${font.styleCount} ${font.styleCount === 1 ? "style" : "styles"}`,
    categories,
  ]
    .filter(Boolean)
    .join(" · ");

  // Reserve two lines in grid cells and one in list rows, so the card does not jump on load.
  const reserved = list ? Math.ceil(size * 1.15) : Math.ceil(size * 1.05 * 2);

  return (
    <article
      ref={ref}
      className={
        list
          ? "group relative grid min-w-0 [contain:inline-size] grid-cols-1 gap-3 px-1 py-5 transition-colors duration-150 hover:bg-ground-2 md:grid-cols-[18rem_minmax(0,1fr)] md:gap-x-8 md:px-4"
          : "group relative flex h-full min-w-0 [contain:inline-size] flex-col gap-4 p-5 transition-colors duration-150 hover:bg-ground-2 md:p-6"
      }
    >
      <div className={list ? "flex min-w-0 items-start justify-between gap-3 md:col-start-1 md:row-start-1" : "flex items-start justify-between gap-3"}>
        <div className="min-w-0">
          <h2 className="text-[15px] leading-6 font-medium text-ink">
            {/* Stretched link: the title link covers the whole card. The favorite button sits above it. */}
            <Link
              href={`/font/${font.slug}`}
              className="underline-offset-4 after:absolute after:inset-0 after:content-[''] group-hover:underline"
            >
              {font.family}
            </Link>
          </h2>
          <p className="mt-1 truncate font-mono text-[11px] leading-4 tracking-[0.06em] text-muted uppercase tabular-nums">
            {meta}
          </p>
        </div>
        <FavoriteButton slug={font.slug} family={font.family} />
      </div>

      <div
        className={list ? "relative min-w-0 md:col-start-2 md:row-start-1" : "relative min-w-0"}
        style={{ minHeight: reserved }}
      >
        <p
          className={
            list
              ? "truncate whitespace-nowrap text-ink"
              : "line-clamp-3 text-ink [overflow-wrap:anywhere]"
          }
          style={{
            fontFamily: `'${font.family}', system-ui`,
            fontWeight: font.previewWeight,
            fontStyle: font.previewStyle,
            fontSize: size,
            lineHeight: list ? 1.15 : 1.05,
            visibility: ready ? "visible" : "hidden",
          }}
        >
          {sample}
        </p>

        {status === "loading" && (
          <>
            {/* Placeholder: rule-coloured hairlines at roughly text baseline heights. Never a fallback face. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <span className="absolute left-0 h-px w-3/5 bg-rule" style={{ top: Math.round(size * 0.8) }} />
              {!list && (
                <span className="absolute left-0 h-px w-2/5 bg-rule" style={{ top: Math.round(size * 1.85) }} />
              )}
            </div>
            <span className="sr-only">Loading font…</span>
          </>
        )}
        {status === "error" && (
          <p className="absolute left-0 top-0 font-mono text-[11px] tracking-[0.06em] text-muted uppercase">
            Preview unavailable
          </p>
        )}
      </div>
    </article>
  );
}
