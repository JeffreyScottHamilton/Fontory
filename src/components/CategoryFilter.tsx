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

  return (
    <div role="group" aria-label="Categories" className="flex flex-wrap gap-2">
      {CATEGORIES.map((category) => {
        const active = selected.includes(category.id);
        const count = counts?.[category.id];
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(category.id)}
            className={
              active
                ? "inline-flex min-h-11 items-center gap-2 border border-ink bg-ink px-3 py-1.5 text-sm text-ground"
                : "inline-flex min-h-11 items-center gap-2 border border-rule px-3 py-1.5 text-sm text-ink hover:border-ink"
            }
          >
            {category.label}
            {count !== undefined && (
              <span className={active ? "tabular-nums text-ground opacity-75" : "tabular-nums text-muted"}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
