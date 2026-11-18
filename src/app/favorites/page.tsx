import type { Metadata } from "next";
import FavoritesView from "@/components/favorites/FavoritesView";
import { getIndex } from "@/lib/data";

export const metadata: Metadata = {
  title: "Favorites",
};

export default function FavoritesPage() {
  return <FavoritesView index={getIndex()} />;
}
