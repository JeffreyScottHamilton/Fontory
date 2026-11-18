"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import FavoriteDownload from "@/components/favorites/FavoriteDownload";
import { DEFAULT_SAMPLE } from "@/lib/preview";
import { useFontReady } from "@/lib/useFontStylesheet";
import { CATEGORIES, type FontIndexEntry } from "@/lib/types";

const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.id, c.label]));

interface FavoriteRowProps {
  font: FontIndexEntry;
  text: string;
  size: number;
  /** Removes the favorite. The parent owns focus after the row unmounts. */
  onRemove: (slug: string) => void;
}

export default function FavoriteRow({ font, text, size, onRemove }: FavoriteRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Load the face only once the row is near the viewport, as the browse cards do.
  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
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
  const sample = text.trim() === "" ? DEFAULT_SAMPLE : text;
  const categories = font.categories.map((c) => CATEGORY_LABEL.get(c) ?? c).join(" · ");
  const meta = [font.designer, `${font.styleCount} ${font.styleCount === 1 ? "style" : "styles"}`, categories]
    .filter(Boolean)
    .join(" · ");

  const specimen: CSSProperties = {
    fontFamily: `'${font.family}', system-ui`,
    fontWeight: font.previewWeight,
    fontStyle: font.previewStyle,
    fontSize: size,
    lineHeight: 1.1,
    visibility: ready ? "visible" : "hidden",
  };

  return (
    <article className="grid min-w-0 gap-5 py-8 md:grid-cols-[18rem_minmax(0,1fr)] md:gap-x-10 md:py-10">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="min-w-0">
          <h2 className="text-[15px] leading-6 font-medium text-ink">
            <Link href={`/font/${font.slug}`} className="underline-offset-4 hover:underline">
              {font.family}
            </Link>
          </h2>
          <p className="label-mono mt-1 truncate">{meta}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <FavoriteDownload slug={font.slug} name={font.family} />
          <button
            type="button"
            data-remove-slug={font.slug}
            aria-label={`Remove ${font.family}`}
            onClick={() => onRemove(font.slug)}
            className="btn btn-tertiary"
          >
            Remove
          </button>
        </div>
      </div>

      <div ref={ref} className="relative min-w-0" style={{ minHeight: Math.ceil(size * 1.1) }}>
        <p className="line-clamp-2 text-ink [overflow-wrap:anywhere]" style={specimen}>
          {sample}
        </p>
        {status === "loading" && (
          <>
            {/* Placeholder hairline at roughly the text baseline. Never a fallback face. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <span className="absolute left-0 h-px w-3/5 bg-rule" style={{ top: Math.round(size * 0.8) }} />
            </div>
            <span className="sr-only">Loading font…</span>
          </>
        )}
        {status === "error" && <p className="label-mono absolute top-0 left-0">Preview unavailable</p>}
      </div>
    </article>
  );
}
