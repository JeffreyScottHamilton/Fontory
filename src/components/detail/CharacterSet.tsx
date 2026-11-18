import DetailSection from "@/components/detail/DetailSection";
import GlyphGrid from "@/components/detail/GlyphGrid";
import { glyphRows } from "@/components/detail/format";

interface CharacterSetProps {
  family: string;
  subsets: string[];
  weight: number;
  style: "normal" | "italic";
}

export default function CharacterSet({ family, subsets, weight, style }: CharacterSetProps) {
  return (
    <DetailSection id="charset-heading" number="03" title="Character set">
      <GlyphGrid family={family} weight={weight} style={style} rows={glyphRows(subsets)} />
    </DetailSection>
  );
}
