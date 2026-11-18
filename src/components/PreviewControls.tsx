"use client";

import { useId } from "react";
import { MAX_SIZE, MIN_SIZE, usePreview } from "@/lib/preview";

interface PreviewControlsProps {
  compact?: boolean;
  className?: string;
}

export default function PreviewControls({ compact = false, className }: PreviewControlsProps) {
  const [state, setText, setSize] = usePreview();
  const textId = useId();
  const sizeId = useId();

  const layout = compact
    ? "flex flex-wrap items-end gap-x-6 gap-y-4"
    : "grid gap-6 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-end";

  return (
    <div className={className ? `${layout} ${className}` : layout}>
      <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-1">
        <label htmlFor={textId} className="label-mono">
          Preview text
        </label>
        <input
          id={textId}
          type="text"
          value={state.text}
          placeholder="Type to preview"
          onChange={(e) => setText(e.target.value)}
          className="field"
        />
      </div>

      <div className={compact ? "flex w-full flex-col gap-1 sm:w-56 sm:shrink-0" : "flex flex-col gap-1"}>
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor={sizeId} className="label-mono">
            Size
          </label>
          <output htmlFor={sizeId} className="font-mono text-[12px] tabular-nums text-ink">
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
        />
      </div>
    </div>
  );
}
