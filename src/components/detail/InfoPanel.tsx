import { axesText, categoryLabel, evidenceText, weightsText } from "@/components/detail/format";
import type { FontFamily } from "@/lib/types";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-rule py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

const LINK = "underline underline-offset-2 hover:text-muted";

export default function InfoPanel({ font: f }: { font: FontFamily }) {
  const upright = f.styles.filter((s) => s.style === "normal").length;
  const italic = f.styles.length - upright;
  const styleCount = `${f.styles.length} ${f.styles.length === 1 ? "style" : "styles"} (${upright} upright, ${italic} italic)`;
  const upstreamLabel = f.upstream?.repositoryUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

  return (
    <dl className="flex flex-col">
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

      <Row label="Categories">
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
      </Row>

      <Row label="Weights">
        <p>{weightsText(f)}</p>
        <p className="mt-1 text-sm text-muted">{styleCount}</p>
      </Row>

      {f.isVariable && <Row label="Variable axes">{axesText(f.axes)}</Row>}

      <Row label="Subsets">{f.subsets.join(", ")}</Row>

      <Row label="Added">
        <time dateTime={f.dateAdded}>{f.dateAdded}</time>
      </Row>

      <Row label="Source">
        <a href={f.source.url} className={LINK}>
          google/fonts @ {f.source.commit.slice(0, 7)}
        </a>
      </Row>

      {f.upstream && (
        <Row label="Upstream">
          <a href={f.upstream.repositoryUrl} className={LINK}>
            {upstreamLabel}
          </a>
          {f.upstream.commit ? <span className="text-muted"> @ {f.upstream.commit.slice(0, 7)}</span> : null}
        </Row>
      )}

      <div className="pt-3">
        <p className="text-xs text-muted [overflow-wrap:anywhere]">{f.copyright}</p>
      </div>
    </dl>
  );
}
