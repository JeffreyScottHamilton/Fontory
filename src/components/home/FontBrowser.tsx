"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import CategoryFilter from "@/components/CategoryFilter";
import FontCard from "@/components/FontCard";
import PreviewControls from "@/components/PreviewControls";
import { filterFonts, type SortKey } from "@/lib/search";
import { usePreview } from "@/lib/preview";
import { CATEGORIES, type CategoryId, type FontIndexEntry } from "@/lib/types";
import {
  DEFAULT_HOME_STATE,
  SORT_KEYS,
  buildHomeSearch,
  isSortKey,
  parseHomeParams,
  type HomeState,
} from "@/components/home/url-state";

const PAGE_SIZE = 36;

const INPUT_CLASS =
  "min-h-11 w-full border border-rule bg-ground px-3 text-base text-ink placeholder:text-muted";
const SORT_LABEL: Record<SortKey, string> = {
  az: "A–Z",
  newest: "Newest",
  styles: "Most styles",
};

function toggleClass(active: boolean): string {
  return active
    ? "inline-flex min-h-11 items-center border border-ink bg-ink px-3 text-sm text-ground"
    : "inline-flex min-h-11 items-center border border-rule px-3 text-sm text-ink hover:border-ink";
}

/**
 * Reports the URL query whenever it changes, including same-path client navigations
 * (for example the header "Browse" link from /?q=x). Renders nothing.
 */
function UrlSearchSync({ onSearch }: { onSearch: (search: string) => void }) {
  const search = useSearchParams().toString();
  useEffect(() => {
    onSearch(search);
  }, [search, onSearch]);
  return null;
}

interface FontBrowserProps {
  index: FontIndexEntry[];
}

export default function FontBrowser({ index }: FontBrowserProps) {
  const [filters, setFilters] = useState<HomeState>(DEFAULT_HOME_STATE);
  const [ready, setReady] = useState(false);
  // The query string this component last wrote to the URL (or read from it).
  // Echoes of our own writes match it and are ignored.
  const urlSearchRef = useRef("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const deferredQ = useDeferredValue(filters.q);
  const [preview] = usePreview();

  const searchRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const sortId = useId();

  // The URL is read on mount and again on every client navigation. Writing only
  // starts after the first read, so the defaults from the first render never
  // overwrite a shared link. Our own writes are skipped as echoes.
  const onUrlSearch = useCallback((search: string) => {
    setReady(true);
    if (search === urlSearchRef.current) return;
    urlSearchRef.current = search;
    setFilters(parseHomeParams(search));
    setVisible(PAGE_SIZE);
  }, []);

  // Mirror state into the URL without navigation. replaceState does not scroll.
  useEffect(() => {
    if (!ready) return;
    const search = buildHomeSearch(filters);
    const next = `${window.location.pathname}${search ? `?${search}` : ""}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (next !== current) {
      urlSearchRef.current = search;
      window.history.replaceState(window.history.state, "", next);
    }
  }, [ready, filters]);

  // "/" focuses search unless the user is already typing in a field.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const patch = (next: Partial<HomeState>) => {
    setFilters((current) => ({ ...current, ...next }));
    setVisible(PAGE_SIZE);
  };

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<CategoryId, number>> = {};
    for (const font of index) {
      for (const c of font.categories) counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  }, [index]);

  const results = useMemo(
    () =>
      filterFonts(index, {
        q: deferredQ,
        categories: filters.categories,
        italic: filters.italic,
        variable: filters.variable,
        sort: filters.sort,
      }),
    [index, deferredQ, filters.categories, filters.italic, filters.variable, filters.sort],
  );

  const shown = results.slice(0, visible);
  const hasMore = visible < results.length;

  // Load the next page when the sentinel scrolls near the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible((v) => v + PAGE_SIZE);
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, visible]);

  const queryText = filters.q.trim();
  const count = results.length;
  const countLabel = count === 1 ? "1 family" : `${count} families`;

  return (
    <section aria-label="Browse fonts" className="flex flex-col gap-8">
      <Suspense fallback={null}>
        <UrlSearchSync onSearch={onUrlSearch} />
      </Suspense>
      <div className="grid gap-6 border-y border-rule py-6">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-end">
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={searchId} className="text-sm text-muted">
              Search fonts
            </label>
            <input
              ref={searchRef}
              id={searchId}
              type="search"
              value={filters.q}
              placeholder="Search by name or designer"
              autoComplete="off"
              onChange={(e) => patch({ q: e.target.value.slice(0, 200) })}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={sortId} className="text-sm text-muted">
              Sort
            </label>
            <select
              id={sortId}
              value={filters.sort}
              onChange={(e) => {
                const value = e.target.value;
                patch({ sort: isSortKey(value) ? value : DEFAULT_HOME_STATE.sort });
              }}
              className={INPUT_CLASS}
            >
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SORT_LABEL[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="[&_button]:min-h-11">
            <CategoryFilter
              selected={filters.categories}
              onChange={(next) => patch({ categories: CATEGORIES.map((c) => c.id).filter((id) => next.includes(id)) })}
              counts={categoryCounts}
            />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Styles">
            <button
              type="button"
              aria-pressed={filters.italic}
              onClick={() => patch({ italic: !filters.italic })}
              className={toggleClass(filters.italic)}
            >
              Italics
            </button>
            <button
              type="button"
              aria-pressed={filters.variable}
              onClick={() => patch({ variable: !filters.variable })}
              className={toggleClass(filters.variable)}
            >
              Variable
            </button>
          </div>
        </div>

        <PreviewControls />
      </div>

      <p aria-live="polite" className="text-sm text-muted tabular-nums">
        {countLabel}
      </p>

      {count === 0 ? (
        <div className="flex flex-col items-start gap-4 py-12">
          <p className="text-lg text-ink">
            {queryText ? `No fonts match “${queryText}”.` : "No fonts match the selected filters."}
          </p>
          <button
            type="button"
            onClick={() => patch({ q: "", categories: [], italic: false, variable: false })}
            className="inline-flex min-h-11 items-center border border-ink px-4 text-sm text-ink hover:bg-ink hover:text-ground"
          >
            Clear search and filters
          </button>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 border-t border-rule md:grid-cols-2 xl:grid-cols-3">
            {shown.map((font) => (
              <li
                key={font.slug}
                className="min-w-0 border-b border-rule px-4 [&>article]:border-b-0 md:[&:nth-child(2n+1)]:border-r xl:[&:nth-child(2n+1)]:border-r-0 xl:[&:nth-child(3n+1)]:border-r xl:[&:nth-child(3n+2)]:border-r"
              >
                <FontCard font={font} text={preview.text} size={preview.size} />
              </li>
            ))}
          </ul>

          {hasMore && (
            <div className="flex flex-col items-center gap-3">
              <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="inline-flex min-h-11 items-center border border-rule px-5 text-sm text-ink hover:border-ink"
              >
                Show more
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
