import Link from "next/link";
import { getAllFamilies } from "@/lib/data";
import { CATEGORIES, COLLECTIONS, type CollectionId } from "@/lib/types";

// Colophon. Computed from the family records, so counts, licenses and pinned snapshots match the data.

const LABEL = "label-mono";
const COLLECTION_ORDER: CollectionId[] = ["google-fonts", "league", "velvetyne", "fontsource"];

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export default function SiteFooter() {
  const families = getAllFamilies();
  const styleCount = families.reduce((n, f) => n + f.styles.length, 0);

  const byLicense = new Map<string, { name: string; count: number }>();
  for (const f of families) {
    const entry = byLicense.get(f.license) ?? { name: f.licenseName, count: 0 };
    entry.count += 1;
    byLicense.set(f.license, entry);
  }
  const licenses = [...byLicense.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const collections = COLLECTION_ORDER.map((id) => {
    const members = families.filter((f) => f.collection === id);
    return { id, count: members.length, commit: members[0]?.source.commit };
  }).filter((c) => c.count > 0);

  const attribution = joinNames(collections.map((c) => COLLECTIONS[c.id].name));

  return (
    <footer className="mt-auto border-t border-rule">
      <div className="site-container py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-12 md:gap-8">
          <section aria-labelledby="footer-about" className="flex flex-col gap-4 md:col-span-5">
            <h2 id="footer-about" className={LABEL}>
              About
            </h2>
            <p className="max-w-[44ch] text-sm leading-relaxed text-ink">
              Fontory is an independent catalogue of {families.length.toLocaleString("en-US")} font families and{" "}
              {styleCount.toLocaleString("en-US")} styles from {attribution}. Every file is served from its pinned
              source snapshot, unchanged.
            </p>
          </section>

          <section aria-labelledby="footer-source" className="flex flex-col gap-4 md:col-span-4">
            <h2 id="footer-source" className={LABEL}>
              Source &amp; licenses
            </h2>
            <ul className="flex flex-col divide-y divide-rule border-y border-rule text-sm">
              {licenses.map((l) => (
                <li key={l.name} className="flex items-baseline justify-between gap-4 py-2">
                  <span className="text-ink">{l.name}</span>
                  <span className="font-mono text-[12px] tabular-nums text-muted">
                    {l.count.toLocaleString("en-US")}
                  </span>
                </li>
              ))}
            </ul>
            <ul className="flex flex-col gap-2 text-sm text-muted">
              {collections.map((c) => (
                <li key={c.id}>
                  <Link
                    href={COLLECTIONS[c.id].href}
                    className="text-ink underline underline-offset-4 hover:text-accent"
                  >
                    {COLLECTIONS[c.id].repoLabel}
                  </Link>
                  {c.commit && <span className="font-mono text-[12px]"> · snapshot {c.commit.slice(0, 7)}</span>}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="footer-colophon" className="flex flex-col gap-4 md:col-span-3">
            <h2 id="footer-colophon" className={LABEL}>
              Colophon
            </h2>
            <p className="font-display text-xl leading-snug text-ink">
              Set in <em className="italic">Newsreader</em>, Geist and Geist Mono.
            </p>
            <p className="text-sm text-muted">
              {CATEGORIES.length} categories, each assigned from recorded metadata or tag evidence.
            </p>
          </section>
        </div>

        <p className="mt-12 border-t border-rule pt-6 text-sm text-muted">Each family keeps its original license.</p>
      </div>
    </footer>
  );
}
