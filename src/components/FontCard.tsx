"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import FavoriteButton from "@/components/FavoriteButton";
import { DEFAULT_SAMPLE } from "@/lib/preview";
import { useFontReady } from "@/lib/useFontStylesheet";
import { CATEGORIES, type FontIndexEntry } from "@/lib/types";

const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.id, c.label]));

interface FontCardProps {
  font: FontIndexEntry;
  text: string;
  size: number;
}

export default function FontCard({ font, text, size }: FontCardProps) {
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

  const sample = text.trim() === "" ? DEFAULT_SAMPLE : text;
  const categories = font.categories.map((c) => CATEGORY_LABEL.get(c) ?? c).join(", ");

  return (
    <article ref={ref} className="border-b border-rule py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-medium text-ink">
            <Link href={`/font/${font.slug}`} className="underline-offset-4 hover:underline">
              {font.family}
            </Link>
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {font.designer} · {font.styleCount} {font.styleCount === 1 ? "style" : "styles"}
            {categories ? ` · ${categories}` : null}
          </p>
        </div>
        <FavoriteButton slug={font.slug} family={font.family} />
      </div>

      <p
        className="mt-3 overflow-hidden text-ink [overflow-wrap:anywhere] line-clamp-2 sm:line-clamp-none sm:block sm:truncate"
        style={{
          fontFamily: `'${font.family}', system-ui`,
          fontWeight: font.previewWeight,
          fontStyle: font.previewStyle,
          fontSize: size,
          minHeight: Math.ceil(size * 1.3),
          visibility: ready ? "visible" : "hidden",
        }}
      >
        {sample}
      </p>

      {status === "loading" && <p className="mt-1 text-xs text-muted">Loading font…</p>}
      {status === "error" && <p className="mt-1 text-xs text-muted">Preview unavailable</p>}
    </article>
  );
}
