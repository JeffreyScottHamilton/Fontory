import DetailSection from "@/components/detail/DetailSection";
import GlyphGrid from "@/components/detail/GlyphGrid";
import { glyphRows } from "@/components/detail/format";
import type { FontStyle } from "@/lib/types";

interface CharacterSetProps {
  family: string;
  subsets: string[];
  weight: number;
  style: "normal" | "italic";
  /** The family's styles, so the glyph grid shares DetailPreview's stylesheet. */
  styles?: FontStyle[];
}

export default function CharacterSet({ family, subsets, weight, style, styles }: CharacterSetProps) {
  return (
    <DetailSection id="charset-heading" number="03" title="Character set">
      <GlyphGrid family={family} weight={weight} style={style} rows={glyphRows(subsets)} styles={styles} />
    </DetailSection>
  );
}
