import { CATEGORIES, type CategoryId } from "@/lib/types";
import type { SortKey } from "@/lib/search";

// Pure URL <-> filter-state helpers for the home page. No DOM access here.

export const SORT_KEYS: readonly SortKey[] = ["az", "newest", "styles"];
export const MAX_QUERY_LENGTH = 200;

const CATEGORY_IDS: ReadonlySet<string> = new Set(CATEGORIES.map((c) => c.id));

export interface HomeState {
  q: string;
  categories: CategoryId[];
  italic: boolean;
  variable: boolean;
  sort: SortKey;
}

export const DEFAULT_HOME_STATE: HomeState = {
  q: "",
  categories: [],
  italic: false,
  variable: false,
  sort: "az",
};

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === "string" && (SORT_KEYS as readonly string[]).includes(value);
}

/** Reads ?q=, ?c=, ?italic=1, ?variable=1, ?sort= and drops anything unknown. */
export function parseHomeParams(search: string): HomeState {
  const params = new URLSearchParams(search);

  const q = (params.get("q") ?? "").slice(0, MAX_QUERY_LENGTH);

  const categories: CategoryId[] = [];
  for (const part of (params.get("c") ?? "").split(",")) {
    const id = part.trim();
    if (CATEGORY_IDS.has(id) && !categories.includes(id as CategoryId)) {
      categories.push(id as CategoryId);
    }
  }

  const sortParam = params.get("sort");
  const sort: SortKey = isSortKey(sortParam) ? sortParam : DEFAULT_HOME_STATE.sort;

  return {
    q,
    categories,
    italic: params.get("italic") === "1",
    variable: params.get("variable") === "1",
    sort,
  };
}

/** Serialises non-default state only. Categories are written in CATEGORIES order. */
export function buildHomeSearch(state: HomeState): string {
  const params = new URLSearchParams();
  const q = state.q.trim();
  if (q) params.set("q", q);
  if (state.categories.length > 0) {
    const ordered = CATEGORIES.map((c) => c.id).filter((id) => state.categories.includes(id));
    params.set("c", ordered.join(","));
  }
  if (state.italic) params.set("italic", "1");
  if (state.variable) params.set("variable", "1");
  if (state.sort !== DEFAULT_HOME_STATE.sort) params.set("sort", state.sort);
  return params.toString();
}
