import Link from "next/link";
import importReport from "../../data/import-report.json";
import { CATEGORIES } from "@/lib/types";

// Colophon. Server-rendered from the import report, so the counts and the pinned snapshot are real.

const LICENSE_LABEL: Record<string, string> = {
  OFL: "SIL Open Font License 1.1",
  APACHE2: "Apache License 2.0",
  UFL: "Ubuntu Font Licence 1.0",
};

const LABEL = "label-mono";

export default function SiteFooter() {
  const { commit, totals } = importReport;
  const shortSha = commit.slice(0, 7);
  const licenses = Object.entries(totals.byLicense) as [string, number][];

  return (
    <footer className="mt-auto border-t border-rule">
      <div className="site-container py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-12 md:gap-8">
          <section aria-labelledby="footer-about" className="flex flex-col gap-4 md:col-span-5">
            <h2 id="footer-about" className={LABEL}>
              About
            </h2>
            <p className="max-w-[44ch] text-sm leading-relaxed text-ink">
              Fontory is an independent catalogue of {totals.families.toLocaleString("en-US")} font families
              and {totals.styles.toLocaleString("en-US")} styles from the Google Fonts collection. Every file
              is served from the pinned snapshot, unchanged.
            </p>
          </section>

          <section aria-labelledby="footer-source" className="flex flex-col gap-4 md:col-span-4">
            <h2 id="footer-source" className={LABEL}>
              Source &amp; licenses
            </h2>
            <ul className="flex flex-col divide-y divide-rule border-y border-rule text-sm">
              {licenses.map(([id, count]) => (
                <li key={id} className="flex items-baseline justify-between gap-4 py-2">
                  <span className="text-ink">{LICENSE_LABEL[id] ?? id}</span>
                  <span className="font-mono text-[12px] tabular-nums text-muted">
                    {count.toLocaleString("en-US")}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted">
              <Link
                href="https://github.com/google/fonts"
                className="text-ink underline underline-offset-4 hover:text-accent"
              >
                github.com/google/fonts
              </Link>
              <span className="font-mono text-[12px]"> · snapshot {shortSha}</span>
            </p>
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
