import FontBrowser from "@/components/home/FontBrowser";
import { getIndex } from "@/lib/data";
import { CATEGORIES } from "@/lib/types";

export default function HomePage() {
  const index = getIndex();
  const familyCount = index.length;
  const styleCount = index.reduce((total, font) => total + font.styleCount, 0);
  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-6 pt-2 md:pt-8">
        <h1 className="font-display text-[clamp(3.5rem,10vw,9rem)] leading-[0.95] font-normal tracking-[-0.035em] text-ink">
          Find your <em className="italic">type.</em>
        </h1>
        {/* Real counts from the index. Literal uppercase, so the DOM text is the label the reader sees. */}
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[12px] leading-5 tracking-[0.08em] text-ink tabular-nums uppercase md:text-[13px]">
          <span>{fmt(familyCount)} FAMILIES</span>
          <span aria-hidden="true" className="text-muted">/</span>
          <span>{fmt(styleCount)} STYLES</span>
          <span aria-hidden="true" className="text-muted">/</span>
          <span>{CATEGORIES.length} CATEGORIES</span>
          <span aria-hidden="true" className="text-muted">/</span>
          <span>OPEN LICENSES</span>
        </p>
        <p className="max-w-[52ch] text-base leading-relaxed text-muted md:text-lg">
          Open-licensed families from the Google Fonts collection, each shown in its own letterforms. Narrow the
          list, compare two faces, and download the files with their license.
        </p>
      </section>
      <FontBrowser index={index} />
    </div>
  );
}
