import GlyphGrid from "@/components/detail/GlyphGrid";
import { glyphRows } from "@/components/detail/format";

interface CharacterSetProps {
  family: string;
  subsets: string[];
  weight: number;
  style: "normal" | "italic";
}

export default function CharacterSet({ family, subsets, weight, style }: CharacterSetProps) {
  return <GlyphGrid family={family} weight={weight} style={style} rows={glyphRows(subsets)} />;
}
