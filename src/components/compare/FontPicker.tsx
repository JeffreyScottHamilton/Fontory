"use client";

import { useId, useMemo, useState } from "react";
import { filterFonts } from "@/lib/search";
import type { FontIndexEntry } from "@/lib/types";

const RESULT_LIMIT = 8;

interface FontPickerProps {
  label: string;
  index: FontIndexEntry[];
  onPick: (slug: string) => void;
}

export default function FontPicker({ label, index, onPick }: FontPickerProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => filterFonts(index, { q: query, sort: "az" }).slice(0, RESULT_LIMIT),
    [index, query],
  );

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm text-muted">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={query}
        placeholder="Search fonts"
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border border-rule bg-ground px-3 py-2 text-base text-ink placeholder:text-muted"
      />
      {results.length > 0 ? (
        <ul aria-label={`${label} results`} className="flex flex-col border border-rule">
          {results.map((entry) => (
            <li key={entry.slug} className="border-b border-rule last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  onPick(entry.slug);
                  setQuery("");
                }}
                className="flex min-h-11 w-full min-w-0 flex-col justify-center px-3 py-2 text-left hover:underline underline-offset-4"
              >
                <span className="truncate text-ink">{entry.family}</span>
                <span className="truncate text-xs text-muted">{entry.designer}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        query.trim() !== "" && <p className="text-sm text-muted">No matching fonts.</p>
      )}
    </div>
  );
}
