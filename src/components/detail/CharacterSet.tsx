import DetailSection from "@/components/detail/DetailSection";
import GlyphGrid from "@/components/detail/GlyphGrid";
import { glyphRows } from "@/components/detail/format";
import type { FontStyle } from "@/lib/types";
import type { ReadyFont } from "@/lib/useFontStylesheet";

interface CharacterSetProps {
  font: ReadyFont;
  subsets: string[];
  weight: number;
  style: "normal" | "italic";
  /** The family's styles, so the glyph grid shares DetailPreview's stylesheet. */
  styles?: FontStyle[];
}

export default function CharacterSet({ font, subsets, weight, style, styles }: CharacterSetProps) {
  return (
    <DetailSection id="charset-heading" number="03" title="Character set">
      <GlyphGrid font={font} weight={weight} style={style} rows={glyphRows(subsets)} styles={styles} />
    </DetailSection>
  );
}
