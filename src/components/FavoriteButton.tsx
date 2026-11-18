"use client";

import { toggleFavorite, useFavorites } from "@/lib/favorites";

interface FavoriteButtonProps {
  slug: string;
  family: string;
}

export default function FavoriteButton({ slug, family }: FavoriteButtonProps) {
  const favorites = useFavorites();
  const pressed = favorites.includes(slug);

  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={`Favorite ${family}`}
      title={pressed ? "In favorites: click to remove" : "Not in favorites: click to add"}
      onClick={() => toggleFavorite(slug)}
      className={`relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center transition-colors duration-150 ${
        pressed ? "text-accent" : "text-ink hover:text-accent"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        aria-hidden="true"
        focusable="false"
        fill={pressed ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinejoin="round"
      >
        <path d="M12 20.2s-7.6-4.5-7.6-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.6 2.6c0 5.7-7.6 10.2-7.6 10.2z" />
      </svg>
    </button>
  );
}
