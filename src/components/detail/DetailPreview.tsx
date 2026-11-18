"use client";

import { useId } from "react";
import { StyleDownloadLink } from "@/components/DownloadButton";
import { styleLabel } from "@/components/detail/format";
import { cssUrl } from "@/lib/google-css";
import { MAX_SIZE, MIN_SIZE, usePreview } from "@/lib/preview";
import type { FontStyle } from "@/lib/types";
import { useFontReady, useFontStylesheet, type FontReadyStatus } from "@/lib/useFontStylesheet";

const INPUT_CLASS = "w-full border border-rule bg-ground px-3 py-2 text-base text-ink placeholder:text-muted";
const ROW_MAX_SIZE = 40;

interface DetailPreviewProps {
  family: string;
  styles: FontStyle[];
  previewWeight: number;
  previewStyle: "normal" | "italic";
  isVariable: boolean;
  axesText: string;
  weightsText: string;
}

function faceFont(family: string, weight: number, style: "normal" | "italic") {
  return { fontFamily: `'${family}', system-ui`, fontWeight: weight, fontStyle: style };
}

function StatusNote({ status }: { status: FontReadyStatus }) {
  if (status === "loading") return <p className="mt-1 text-xs text-muted">Loading font…</p>;
  if (status === "error") return <p className="mt-1 text-xs text-muted">Preview unavailable</p>;
  return null;
}

function StyleRow({
  family,
  style,
  text,
  size,
  isVariable,
  axesText,
}: {
  family: string;
  style: FontStyle;
  text: string;
  size: number;
  isVariable: boolean;
  axesText: string;
}) {
  const status = useFontReady(family, style.weight, style.style, true);
  return (
    <li className="flex flex-col gap-3 border-b border-rule py-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">
          {styleLabel(style)}
          {isVariable ? ` · variable, ${axesText}` : null}
        </p>
        <p
          className="mt-1 overflow-hidden text-ink [overflow-wrap:anywhere] line-clamp-2"
          style={{
            ...faceFont(family, style.weight, style.style),
            fontSize: size,
            lineHeight: 1.2,
            visibility: status === "ready" ? "visible" : "hidden",
          }}
        >
          {text}
        </p>
        <StatusNote status={status} />
      </div>
      <div className="shrink-0">
        <StyleDownloadLink style={style} />
      </div>
    </li>
  );
}

export default function DetailPreview({
  family,
  styles,
  previewWeight,
  previewStyle,
  isVariable,
  axesText,
  weightsText,
}: DetailPreviewProps) {
  const [state, setText, setSize] = usePreview();
  const textId = useId();
  const sizeId = useId();

  // Loads every style of the family in one stylesheet.
  const sheet = useFontStylesheet(cssUrl(family, styles));
  const heroStatus = useFontReady(family, previewWeight, previewStyle, true);

  const text = state.text.trim() === "" ? family : state.text;
  const rowSize = Math.min(state.size, ROW_MAX_SIZE);
  const heroReady = heroStatus === "ready";

  return (
    <section aria-labelledby="preview-heading" className="flex flex-col gap-8">
      <h2 id="preview-heading" className="text-xl font-semibold tracking-tight">
        Preview
      </h2>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-end">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={textId} className="text-sm text-muted">
            Preview text
          </label>
          <input
            id={textId}
            type="text"
            value={state.text}
            placeholder={family}
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

      <div className="border-b border-rule pb-8">
        <p
          className="overflow-hidden text-ink [overflow-wrap:anywhere]"
          style={{
            ...faceFont(family, previewWeight, previewStyle),
            fontSize: state.size,
            lineHeight: 1.15,
            minHeight: Math.ceil(state.size * 1.15),
            visibility: heroReady ? "visible" : "hidden",
          }}
        >
          {text}
        </p>
        <StatusNote status={heroStatus} />
        {sheet === "error" && (
          <p role="alert" className="mt-2 text-sm text-muted">
            The font stylesheet could not be loaded.
          </p>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold tracking-tight">Styles</h3>
        <p className="mt-1 text-sm text-muted">{weightsText}</p>
        <ol className="mt-4 border-t border-rule">
          {styles.map((style) => (
            <StyleRow
              key={`${style.style}-${style.weight}-${style.filename}`}
              family={family}
              style={style}
              text={text}
              size={rowSize}
              isVariable={isVariable}
              axesText={axesText}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}
