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
  type HomeView,
} from "@/components/home/url-state";

const PAGE_SIZE = 36;

const SORT_LABEL: Record<SortKey, string> = {
  az: "A–Z",
  newest: "Newest",
  styles: "Most styles",
};

const VIEW_LABEL: Record<HomeView, string> = {
  grid: "Grid",
  list: "List",
};

// Chip look shared by the italic / variable toggles (same as CategoryFilter chips).
function toggleClass(active: boolean): string {
  return `inline-flex min-h-11 shrink-0 items-center rounded-[2px] border px-3.5 text-sm font-medium transition-colors duration-150 ${
    active ? "border-ink bg-ink text-ground" : "border-rule text-ink hover:border-ink"
  }`;
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 text-muted"
    >
      <circle cx="7" cy="7" r="4.75" />
      <path d="M10.5 10.5 14 14" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 text-ink"
    >
      <path d="M2 4.25 6 8l4-3.75" />
    </svg>
  );
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
  const countLabel = count === 1 ? "1 family" : `${count.toLocaleString("en-US")} families`;

  const filtersActive =
    queryText !== "" || filters.categories.length > 0 || filters.italic || filters.variable;
  const summaryParts = [
    queryText ? `“${queryText}”` : null,
    filters.categories.length > 0
      ? CATEGORIES.filter((c) => filters.categories.includes(c.id))
          .map((c) => c.label)
          .join(", ")
      : null,
    filters.italic ? "Italics" : null,
    filters.variable ? "Variable" : null,
  ].filter(Boolean);
  const clearFilters = () => patch({ q: "", categories: [], italic: false, variable: false });

  return (
    <section aria-label="Browse fonts" className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <UrlSearchSync onSearch={onUrlSearch} />
      </Suspense>
      <div className="flex flex-col gap-5 border-y border-rule py-4 md:sticky md:top-16 md:z-30 md:-mx-8 md:bg-ground md:px-8 md:py-3 xl:-mx-12 xl:px-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={searchId} className="label-mono">
              Search fonts
            </label>
            <div className="relative">
              <SearchIcon />
              <input
                ref={searchRef}
                id={searchId}
                type="search"
                value={filters.q}
                placeholder="Search by name or designer"
                autoComplete="off"
                onChange={(e) => patch({ q: e.target.value.slice(0, 200) })}
                className="field pl-7 pr-10"
              />
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-0 hidden -translate-y-1/2 rounded-[2px] border border-rule px-1.5 font-mono text-[11px] leading-5 text-muted md:inline-block"
              >
                /
              </kbd>
            </div>
          </div>

          <PreviewControls compact className="md:flex-[1.4]" />

          <div className="flex w-full flex-col gap-1 md:w-44 md:shrink-0">
            <label htmlFor={sortId} className="label-mono">
              Sort
            </label>
            <div className="relative">
              <select
                id={sortId}
                value={filters.sort}
                onChange={(e) => {
                  const value = e.target.value;
                  patch({ sort: isSortKey(value) ? value : DEFAULT_HOME_STATE.sort });
                }}
                className="field"
              >
                {SORT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABEL[key]}
                  </option>
                ))}
              </select>
              <ChevronIcon />
            </div>
          </div>

          <div className="flex w-full flex-col gap-1 md:w-auto md:shrink-0">
            <span className="label-mono" aria-hidden="true">
              View
            </span>
            <div role="group" aria-label="View" className="flex h-11 items-stretch border border-rule">
              {(Object.keys(VIEW_LABEL) as HomeView[]).map((view) => {
                const active = filters.view === view;
                return (
                  <button
                    key={view}
                    type="button"
                    aria-pressed={active}
                    onClick={() => patch({ view })}
                    className={`flex flex-1 items-center justify-center px-4 text-sm font-medium transition-colors duration-150 md:flex-initial ${
                      active ? "bg-ink text-ground" : "text-ink hover:bg-ground-2"
                    }`}
                  >
                    {VIEW_LABEL[view]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <CategoryFilter
          selected={filters.categories}
          onChange={(next) => patch({ categories: CATEGORIES.map((c) => c.id).filter((id) => next.includes(id)) })}
          counts={categoryCounts}
        />
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0" role="group" aria-label="Styles">
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

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-rule pb-3">
        <p aria-live="polite" className="font-mono text-[13px] tabular-nums text-ink">
          {countLabel}
        </p>
        {(summaryParts.length > 0 || filtersActive) && (
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-muted">
            {summaryParts.length > 0 && <span className="min-w-0 break-words">{summaryParts.join(" · ")}</span>}
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="btn btn-tertiary text-ink">
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {count === 0 ? (
        <div className="flex flex-col items-start gap-4 py-12">
          <p className="font-display text-3xl leading-tight text-ink">
            {queryText ? `No fonts match “${queryText}”.` : "No fonts match the selected filters."}
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="btn btn-secondary"
          >
            Clear search and filters
          </button>
        </div>
      ) : (
        <>
          {/* Grid: cells share hairlines (container draws top and left, each cell draws right and bottom). */}
          <ul
            className={
              filters.view === "list"
                ? "grid grid-cols-1 border-t border-rule"
                : "grid grid-cols-1 border-t border-l border-rule md:grid-cols-2 xl:grid-cols-3"
            }
          >
            {shown.map((font) => (
              <li
                key={font.slug}
                className={
                  filters.view === "list" ? "min-w-0 border-b border-rule" : "min-w-0 border-r border-b border-rule"
                }
              >
                <FontCard font={font} text={preview.text} size={preview.size} view={filters.view} />
              </li>
            ))}
          </ul>

          {hasMore && (
            <div className="flex flex-col items-center gap-3">
              <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="btn btn-secondary"
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
