import DetailSection from "@/components/detail/DetailSection";
import { axesText, categoryLabel, evidenceText, weightsText } from "@/components/detail/format";
import { fileFormatLabel } from "@/lib/preview-css";
import { COLLECTIONS, type FontFamily } from "@/lib/types";

// Hairline two-column facts: mono label on the left, value on the right.
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-rule py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6">
      <dt className="label-mono pt-0.5">{label}</dt>
      <dd className="min-w-0 text-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

const LINK = "underline underline-offset-2 hover:text-muted";

// Count of style files per format label, in first-seen order: "TTF × 4", "OTF × 2".
function formatCounts(f: FontFamily): string {
  const counts = new Map<string, number>();
  for (const s of f.styles) {
    const label = fileFormatLabel(s.filename);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, n]) => `${label} × ${n}`).join(", ");
}

export default function InfoPanel({ font: f }: { font: FontFamily }) {
  const upright = f.styles.filter((s) => s.style === "normal").length;
  const italic = f.styles.length - upright;
  const styleCount = `${f.styles.length} ${f.styles.length === 1 ? "style" : "styles"} (${upright} upright, ${italic} italic)`;
  const upstreamLabel = f.upstream?.repositoryUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const fileCount = `${f.styles.length} font ${f.styles.length === 1 ? "file" : "files"} + ${f.licenseFile}`;
  const webOnly = f.styles.length > 0 && f.styles.every((s) => /\.woff2?$/i.test(s.filename));
  const collection = COLLECTIONS[f.collection];

  return (
    <DetailSection id="license-heading" number="05" title="License & source">
      <dl className="flex flex-col border-b border-rule">
        <Row label="Designer">{f.designer}</Row>

        <Row label="License">
          <p>{f.licenseName}</p>
          <p className="mt-1">
            <a href={f.licenseUrl} className={LINK}>
              View license
            </a>
          </p>
          <p className="mt-1 text-sm text-muted">Included in the download.</p>
        </Row>

        <Row label="Category & evidence">
          {f.categories.length === 0 ? (
            <p>Uncategorized</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {f.categories.map((c) => {
                const evidence = f.categoryEvidence.filter((e) => e.category === c);
                if (evidence.length === 0) return <li key={c}>{categoryLabel(c)}</li>;
                return evidence.map((e) => (
                  <li key={`${c}-${e.source}-${e.detail}`}>
                    {categoryLabel(c)} — {evidenceText(e)}
                  </li>
                ));
              })}
            </ul>
          )}
        </Row>

        <Row label="Weights">
          <p>{weightsText(f)}</p>
          <p className="mt-1 text-sm text-muted">{styleCount}</p>
        </Row>

        {f.isVariable && <Row label="Axes">{axesText(f.axes)}</Row>}

        <Row label="Subsets">{f.subsets.join(", ")}</Row>

        <Row label="Collection">
          <a href={collection.href} className={LINK}>
            {collection.name}
          </a>
        </Row>

        <Row label="Files">
          <p>{fileCount}</p>
          {f.styles.length > 0 && <p className="mt-1 text-sm text-muted">{formatCounts(f)}</p>}
          {webOnly && (
            <div className="mt-2 text-sm text-muted">
              <p>Web font files (WOFF2). Desktop apps may need TTF/OTF from the upstream source.</p>
              {f.upstream && (
                <p className="mt-1">
                  <a href={f.upstream.repositoryUrl} className={LINK}>
                    {upstreamLabel}
                  </a>
                </p>
              )}
            </div>
          )}
        </Row>

        <Row label="Added">
          <time dateTime={f.dateAdded}>{f.dateAdded}</time>
        </Row>

        <Row label="Source">
          <a href={f.source.url} className={LINK}>
            {f.source.repo} @ {f.source.commit.slice(0, 7)}
          </a>
          <p className="mt-1 text-sm text-muted">Host: {f.source.host === "gitlab" ? "GitLab" : "GitHub"}</p>
        </Row>

        {f.upstream && (
          <Row label="Upstream">
            <a href={f.upstream.repositoryUrl} className={LINK}>
              {upstreamLabel}
            </a>
            {f.upstream.commit ? <span className="text-muted"> @ {f.upstream.commit.slice(0, 7)}</span> : null}
          </Row>
        )}
      </dl>

      <p className="text-xs leading-5 text-muted [overflow-wrap:anywhere]">{f.copyright}</p>
    </DetailSection>
  );
}
