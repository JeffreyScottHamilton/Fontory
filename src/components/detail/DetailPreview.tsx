"use client";

import { useId, type CSSProperties } from "react";
import { StyleDownloadLink } from "@/components/DownloadButton";
import DetailSection from "@/components/detail/DetailSection";
import { styleTag, weightTag } from "@/components/detail/format";
import { cssUrl } from "@/lib/google-css";
import { DEFAULT_SAMPLE, MAX_SIZE, MIN_SIZE, usePreview } from "@/lib/preview";
import type { FontStyle } from "@/lib/types";
import { useFontReady, useFontStylesheet, type FontReadyStatus, type StylesheetStatus } from "@/lib/useFontStylesheet";

const ROW_MAX_SIZE = 40;
const WEIGHT_SAMPLE_SIZE = 40;
const WATERFALL_SIZES = [12, 16, 24, 36, 48, 72, 96];

interface DetailPreviewProps {
  family: string;
  styles: FontStyle[];
  /** Standard weights of the family (weights list from the data). */
  weights: number[];
  previewWeight: number;
  previewStyle: "normal" | "italic";
  /** "VARIABLE · WGHT 100–900" for a wght axis, otherwise null. */
  variableLabel: string | null;
  weightsText: string;
}

function faceFont(family: string, weight: number, style: "normal" | "italic"): CSSProperties {
  return { fontFamily: `'${family}', system-ui`, fontWeight: weight, fontStyle: style };
}

function StatusNote({ status }: { status: FontReadyStatus }) {
  if (status === "loading") return <p className="mt-1 text-xs text-muted">Loading font…</p>;
  if (status === "error") return <p className="mt-1 text-xs text-muted">Preview unavailable</p>;
  return null;
}

/** One line of a waterfall: mono label on the left, the sample in the real face. */
function SampleLine({
  label,
  text,
  font,
  ready,
  lineHeight,
}: {
  label: string;
  text: string;
  font: CSSProperties;
  ready: boolean;
  lineHeight: number;
}) {
  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-4 border-t border-rule py-3 md:grid-cols-[6rem_minmax(0,1fr)]">
      <span className="label-mono tabular-nums">{label}</span>
      <p
        className="min-w-0 truncate text-ink"
        style={{ ...font, lineHeight, visibility: ready ? "visible" : "hidden" }}
      >
        {text}
      </p>
    </li>
  );
}

function StyleRow({
  family,
  style,
  text,
  size,
  sheet,
}: {
  family: string;
  style: FontStyle;
  text: string;
  size: number;
  sheet: StylesheetStatus;
}) {
  // The combined stylesheet already carries every face, so no per-style link is injected.
  const status = useFontReady(family, style.weight, style.style, true, { sheet });
  return (
    <li className="grid gap-3 border-t border-rule py-5 md:grid-cols-[9rem_minmax(0,1fr)_auto] md:items-center md:gap-6">
      <span className="label-mono tabular-nums">{styleTag(style)}</span>
      <div className="min-w-0">
        <p
          className="min-w-0 truncate text-ink"
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
  weights,
  previewWeight,
  previewStyle,
  variableLabel,
  weightsText,
}: DetailPreviewProps) {
  const [state, setText, setSize] = usePreview();
  const textId = useId();
  const sizeId = useId();

  // Loads every style of the family in one stylesheet.
  const sheet = useFontStylesheet(cssUrl(family, styles));
  const heroStatus = useFontReady(family, previewWeight, previewStyle, true, { sheet });

  const text = state.text.trim() === "" ? DEFAULT_SAMPLE : state.text;
  const rowSize = Math.min(state.size, ROW_MAX_SIZE);
  const heroReady = heroStatus === "ready";
  const showWeights = variableLabel !== null && weights.length > 1;

  return (
    <>
      <DetailSection id="preview-heading" number="01" title="Preview">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-end">
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={textId} className="label-mono">
              Preview text
            </label>
            <input
              id={textId}
              type="text"
              value={state.text}
              placeholder={family}
              onChange={(e) => setText(e.target.value)}
              className="field"
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <label htmlFor={sizeId} className="label-mono">
                Size
              </label>
              <output htmlFor={sizeId} className="label-mono tabular-nums text-ink">
                {state.size} px
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

        <div className="flex min-w-0 flex-col">
          <p
            className="overflow-hidden pb-6 text-ink [overflow-wrap:anywhere]"
            style={{
              ...faceFont(family, previewWeight, previewStyle),
              fontSize: state.size,
              lineHeight: 1.1,
              minHeight: Math.ceil(state.size * 1.1),
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
          <p className="label-mono mb-1">Size waterfall</p>
          <ul className="border-b border-rule">
            {WATERFALL_SIZES.map((size) => (
              <SampleLine
                key={size}
                label={`${size} px`}
                text={text}
                ready={heroReady}
                lineHeight={1.2}
                font={{ ...faceFont(family, previewWeight, previewStyle), fontSize: size }}
              />
            ))}
          </ul>
        </div>
      </DetailSection>

      <DetailSection id="styles-heading" number="02" title="Styles">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted">{weightsText}</p>
        </div>
        <ol className="border-b border-rule">
          {styles.map((style) => (
            <StyleRow
              key={`${style.style}-${style.weight}-${style.filename}`}
              family={family}
              style={style}
              text={text}
              size={rowSize}
              sheet={sheet}
            />
          ))}
        </ol>

        {showWeights && (
          <div className="flex flex-col gap-2">
            <p className="label-mono">{variableLabel}</p>
            <ul className="border-b border-rule">
              {weights.map((weight) => (
                <SampleLine
                  key={weight}
                  label={weightTag(weight)}
                  text={text}
                  ready={heroReady}
                  lineHeight={1.2}
                  font={{
                    ...faceFont(family, weight, previewStyle),
                    fontSize: WEIGHT_SAMPLE_SIZE,
                  }}
                />
              ))}
            </ul>
          </div>
        )}
      </DetailSection>
    </>
  );
}
