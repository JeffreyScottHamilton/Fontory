import FontBrowser from "@/components/home/FontBrowser";
import { getIndex } from "@/lib/data";

export default function HomePage() {
  const index = getIndex();
  const familyCount = index.length;
  const styleCount = index.reduce((total, font) => total + font.styleCount, 0);
  // One string, so the server HTML holds the sentence as a single text node.
  const factLine = `${familyCount} families · ${styleCount} styles from the Google Fonts collection, free to download under open licenses.`;

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
          Find your type.
        </h1>
        <p className="max-w-2xl text-base text-muted sm:text-lg">{factLine}</p>
      </section>
      <FontBrowser index={index} />
    </div>
  );
}
