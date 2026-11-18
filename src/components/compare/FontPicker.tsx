"use client";

import { useId, useMemo, useRef, useState } from "react";
import { filterFonts } from "@/lib/search";
import type { FontIndexEntry } from "@/lib/types";

const RESULT_LIMIT = 8;

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

interface FontPickerProps {
  label: string;
  index: FontIndexEntry[];
  onPick: (slug: string) => void;
}

export default function FontPicker({ label, index, onPick }: FontPickerProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const searching = query.trim() !== "";
  // The list only opens while there is a query, so the comparison stays above the fold.
  const results = useMemo(
    () => (searching ? filterFonts(index, { q: query, sort: "az" }).slice(0, RESULT_LIMIT) : []),
    [index, query, searching],
  );

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="label-mono">
        {label}
      </label>
      <div className="relative">
        <SearchIcon />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={query}
          placeholder="Search fonts"
          onChange={(e) => setQuery(e.target.value)}
          className="field pl-7"
        />
      </div>
      {searching && results.length > 0 ? (
        <ul aria-label={`${label} results`} className="flex flex-col border-t border-rule">
          {results.map((entry) => (
            <li key={entry.slug} className="border-b border-rule">
              <button
                type="button"
                onClick={() => {
                  onPick(entry.slug);
                  setQuery("");
                  // The result list unmounts with the query, so focus returns to the input.
                  inputRef.current?.focus();
                }}
                className="flex min-h-11 w-full min-w-0 items-baseline justify-between gap-4 py-2 text-left hover:underline underline-offset-4"
              >
                <span className="truncate text-[15px] font-medium text-ink">{entry.family}</span>
                <span className="label-mono shrink-0 truncate text-right">{entry.designer}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        searching && <p className="text-sm text-muted">No matching fonts.</p>
      )}
    </div>
  );
}
