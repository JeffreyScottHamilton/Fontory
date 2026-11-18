"use client";

import { useId } from "react";
import { MAX_SIZE, MIN_SIZE, usePreview } from "@/lib/preview";

interface PreviewControlsProps {
  compact?: boolean;
}

const INPUT_CLASS = "w-full border border-rule bg-ground px-3 py-2 text-base text-ink placeholder:text-muted";

export default function PreviewControls({ compact = false }: PreviewControlsProps) {
  const [state, setText, setSize] = usePreview();
  const textId = useId();
  const sizeId = useId();

  return (
    <div className={compact ? "flex flex-wrap items-end gap-4" : "grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-end"}>
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={textId} className="text-sm text-muted">
          Preview text
        </label>
        <input
          id={textId}
          type="text"
          value={state.text}
          placeholder="Type to preview"
          onChange={(e) => setText(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between text-sm text-muted">
          <label htmlFor={sizeId}>Size</label>
          <output htmlFor={sizeId} className="tabular-nums text-ink">
            {state.size}px
          </output>
        </div>
        <input
          id={sizeId}
          type="range"
          min={MIN_SIZE}
          max={MAX_SIZE}
          step={1}
          value={state.size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-full accent-ink"
        />
      </div>
    </div>
  );
}
