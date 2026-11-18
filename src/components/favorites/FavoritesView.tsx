"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import FavoriteRow from "@/components/favorites/FavoriteRow";
import PreviewControls from "@/components/PreviewControls";
import { removeFavorite, useFavorites } from "@/lib/favorites";
import { usePreview } from "@/lib/preview";
import type { FontIndexEntry } from "@/lib/types";

const noopSubscribe = () => () => {};
const getMounted = () => true;
const getServerMounted = () => false;

// False during hydration and on the server, so no list-dependent markup differs between server and client.
function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, getMounted, getServerMounted);
}

interface FavoritesViewProps {
  index: FontIndexEntry[];
}

export default function FavoritesView({ index }: FavoritesViewProps) {
  const favorites = useFavorites();
  const mounted = useMounted();
  const [preview] = usePreview();

  const fonts = useMemo(() => {
    const bySlug = new Map(index.map((entry) => [entry.slug, entry]));
    const out: FontIndexEntry[] = [];
    for (const slug of favorites) {
      const entry = bySlug.get(slug);
      if (entry) out.push(entry);
    }
    return out;
  }, [index, favorites]);

  function clearAll() {
    if (!window.confirm(`Remove all ${favorites.length} favorites from this browser?`)) return;
    for (const slug of favorites) removeFavorite(slug);
  }

  return (
    <div className="flex flex-col">
      <header className="flex flex-col gap-3 pb-8 md:pb-10">
        <h1 className="font-display text-[clamp(3.5rem,9vw,6.5rem)] leading-[0.95] font-normal tracking-[-0.035em] text-ink">
          Favorites
        </h1>
        {mounted && fonts.length > 0 && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pt-2">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="font-mono text-[13px] tracking-[0.02em] text-ink tabular-nums">
                {fonts.length} {fonts.length === 1 ? "font" : "fonts"} saved
              </p>
              <p className="text-sm text-muted">Saved in this browser only, no account needed.</p>
            </div>
            <button type="button" onClick={clearAll} className="btn btn-tertiary">
              Clear all
            </button>
          </div>
        )}
        {(!mounted || fonts.length === 0) && (
          <p className="max-w-[52ch] text-base leading-relaxed text-muted">
            Saved in this browser only, no account needed.
          </p>
        )}
      </header>

      <div className="border-t border-rule py-6">
        <PreviewControls />
      </div>

      {mounted && fonts.length === 0 && (
        <div className="flex flex-col items-start gap-5 border-t border-rule py-16 md:py-24">
          <p className="font-display text-[clamp(2rem,4vw,3rem)] leading-tight italic text-ink">Nothing saved yet.</p>
          <Link href="/" className="btn btn-tertiary text-ink underline underline-offset-[6px]">
            Browse fonts
          </Link>
        </div>
      )}

      {mounted && fonts.length > 0 && (
        <ul className="flex flex-col border-b border-rule">
          {fonts.map((font) => (
            <li key={font.slug} className="border-t border-rule">
              <FavoriteRow font={font} text={preview.text} size={preview.size} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
