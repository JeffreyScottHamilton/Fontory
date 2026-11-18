"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import FontCard from "@/components/FontCard";
import PreviewControls from "@/components/PreviewControls";
import FavoriteDownload from "@/components/favorites/FavoriteDownload";
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
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Favorites</h1>
        <p className="text-sm text-muted">Saved in this browser only — no account needed.</p>
      </header>

      <PreviewControls />

      {mounted && fonts.length === 0 && (
        <div className="flex flex-col items-start gap-3 border-t border-rule pt-6">
          <p className="text-ink">No favorites yet.</p>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center border border-rule px-4 text-sm text-ink hover:border-ink"
          >
            Browse fonts
          </Link>
        </div>
      )}

      {mounted && fonts.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
            <p className="text-sm text-muted tabular-nums">
              {fonts.length} {fonts.length === 1 ? "font" : "fonts"} saved
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex min-h-11 items-center border border-rule px-4 text-sm text-ink hover:border-ink"
            >
              Clear all
            </button>
          </div>
          <ul className="flex flex-col">
            {fonts.map((font) => (
              <li key={font.slug} className="flex flex-col">
                <FontCard font={font} text={preview.text} size={preview.size} />
                <div className="pb-5">
                  <FavoriteDownload slug={font.slug} name={font.family} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
