"use client";

import { previewHref } from "@/lib/preview-css";
import type { FontStyle } from "@/lib/types";
import { useFontReady, useFontStylesheet, type ReadyFont } from "@/lib/useFontStylesheet";

interface FamilyNameProps {
  font: ReadyFont;
  styles: FontStyle[];
  weight: number;
  style: "normal" | "italic";
}

/**
 * The family name set in its own face. The text stays transparent until the face is ready,
 * so the page never shows a system fallback as a specimen. The sheet is the same href
 * DetailPreview uses, so the stylesheet is injected only once.
 */
export default function FamilyName({ font, styles, weight, style }: FamilyNameProps) {
  const { family } = font;
  const sheet = useFontStylesheet(previewHref(font, styles));
  const status = useFontReady(font, weight, style, true, { sheet });

  if (status === "error") {
    return (
      <h1 className="font-display text-[clamp(4rem,12vw,11rem)] leading-[0.95] font-normal tracking-[-0.02em] text-ink [overflow-wrap:anywhere]">
        {family}
      </h1>
    );
  }

  return (
    <h1
      className="text-[clamp(4rem,12vw,11rem)] leading-[0.95] tracking-[-0.02em] text-ink [overflow-wrap:anywhere]"
      style={{
        fontFamily: `'${family}', system-ui`,
        fontWeight: weight,
        fontStyle: style,
        color: status === "ready" ? undefined : "transparent",
      }}
    >
      {family}
    </h1>
  );
}
