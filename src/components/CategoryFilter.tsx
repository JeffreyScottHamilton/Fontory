"use client";

import { CATEGORIES, type CategoryId } from "@/lib/types";

interface CategoryFilterProps {
  selected: CategoryId[];
  onChange: (next: CategoryId[]) => void;
  counts?: Partial<Record<CategoryId, number>>;
}

export default function CategoryFilter({ selected, onChange, counts }: CategoryFilterProps) {
  const toggle = (id: CategoryId) => {
    onChange(selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id]);
  };

  // Mobile: one row that scrolls sideways inside its own box, so the page never overflows.
  return (
    <div
      role="group"
      aria-label="Categories"
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
    >
      {CATEGORIES.map((category) => {
        const active = selected.includes(category.id);
        const count = counts?.[category.id];
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(category.id)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[2px] border px-3.5 text-sm font-medium transition-colors duration-150 ${
              active ? "border-ink bg-ink text-ground" : "border-rule text-ink hover:border-ink"
            }`}
          >
            {category.label}
            {count !== undefined && (
              <span
                className={`font-mono text-[11px] tabular-nums ${active ? "text-ground/70" : "text-muted"}`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
