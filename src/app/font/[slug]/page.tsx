import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DownloadButton from "@/components/DownloadButton";
import FavoriteButton from "@/components/FavoriteButton";
import FontCard from "@/components/FontCard";
import CharacterSet from "@/components/detail/CharacterSet";
import DetailPreview from "@/components/detail/DetailPreview";
import InfoPanel from "@/components/detail/InfoPanel";
import UseOnWeb from "@/components/detail/UseOnWeb";
import { axesText, weightsText } from "@/components/detail/format";
import { getAllFamilies, getFamily, getIndex, toIndexEntry } from "@/lib/data";
import { cssSnippet } from "@/lib/google-css";
import type { FontIndexEntry } from "@/lib/types";

export const dynamicParams = false;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllFamilies().map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const f = getFamily(slug);
  if (!f) return {};
  return {
    title: f.family,
    description: `${f.family} by ${f.designer} — ${f.licenseName}. Preview and download.`,
  };
}

const SECTION_HEADING = "text-xl font-semibold tracking-tight";

export default async function FontDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const f = getFamily(slug);
  if (!f) notFound();

  const preview = toIndexEntry(f);
  const snippet = cssSnippet(f);
  const bySlug = new Map<string, FontIndexEntry>(getIndex().map((e) => [e.slug, e]));
  const related = f.related
    .slice(0, 6)
    .map((s) => bySlug.get(s))
    .filter((e): e is FontIndexEntry => e !== undefined);

  return (
    <article className="flex flex-col gap-12">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <li>
            <Link href="/" className="hover:text-ink">
              Fonts
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {f.family}
          </li>
        </ol>
      </nav>

      <header className="flex flex-col gap-6 border-b border-rule pb-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{f.family}</h1>
          <p className="mt-2 text-lg text-muted">by {f.designer}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DownloadButton
            family={f.family}
            slug={f.slug}
            styles={f.styles}
            licenseFile={f.licenseFile}
            licenseUrl={f.licenseUrl}
            sourceUrl={f.source.url}
          />
          <FavoriteButton slug={f.slug} family={f.family} />
          <Link
            href={`/compare?a=${f.slug}`}
            className="inline-flex min-h-11 items-center border border-rule px-4 text-sm text-ink hover:border-ink"
          >
            Compare with another font
          </Link>
        </div>
      </header>

      <DetailPreview
        family={f.family}
        styles={f.styles}
        previewWeight={preview.previewWeight}
        previewStyle={preview.previewStyle}
        isVariable={f.isVariable}
        axesText={axesText(f.axes)}
        weightsText={weightsText(f)}
      />

      <section aria-labelledby="charset-heading" className="flex flex-col gap-6">
        <h2 id="charset-heading" className={SECTION_HEADING}>
          Character set
        </h2>
        <CharacterSet
          family={f.family}
          subsets={f.subsets}
          weight={preview.previewWeight}
          style={preview.previewStyle}
        />
      </section>

      <section aria-labelledby="details-heading" className="flex flex-col gap-4">
        <h2 id="details-heading" className={SECTION_HEADING}>
          Details
        </h2>
        <InfoPanel font={f} />
      </section>

      <section aria-labelledby="web-heading" className="flex flex-col gap-4">
        <h2 id="web-heading" className={SECTION_HEADING}>
          Use on the web
        </h2>
        <UseOnWeb
          linkTag={snippet.linkTag}
          importLine={snippet.importLine}
          fontFamilyLine={snippet.fontFamilyLine}
        />
      </section>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="flex flex-col gap-4">
          <h2 id="related-heading" className={SECTION_HEADING}>
            Related fonts
          </h2>
          <ul className="grid sm:grid-cols-2 sm:gap-x-8">
            {related.map((e) => (
              <li key={e.slug}>
                <FontCard font={e} text="" size={32} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
