import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DownloadButton from "@/components/DownloadButton";
import FavoriteButton from "@/components/FavoriteButton";
import FontCard from "@/components/FontCard";
import CharacterSet from "@/components/detail/CharacterSet";
import DetailPreview from "@/components/detail/DetailPreview";
import DetailSection from "@/components/detail/DetailSection";
import FamilyName from "@/components/detail/FamilyName";
import InfoPanel from "@/components/detail/InfoPanel";
import UseOnWeb from "@/components/detail/UseOnWeb";
import { categoryLabel, variableWeightLabel, weightsText } from "@/components/detail/format";
import { getFamily, getIndex, toIndexEntry } from "@/lib/data";
import { cssSnippet } from "@/lib/google-css";
import { PRERENDER_SLUGS } from "@/lib/prerender";
import type { FontIndexEntry } from "@/lib/types";

// Only PRERENDER_SLUGS are prerendered at build time (see src/lib/prerender.ts).
// Other slugs render on first request and are cached indefinitely (revalidate = false).
// Unknown slugs return 404 via notFound().

// force-static is the documented way to get ISR for paths generated at runtime (see
// generateStaticParams docs). This page reads no cookies, headers or search params.
export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = false;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return PRERENDER_SLUGS.filter((slug) => getFamily(slug) !== undefined).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const f = getFamily(slug);
  if (!f) return {};
  const description = `${f.family} by ${f.designer} — ${f.licenseName}. Preview and download.`;
  return {
    title: f.family,
    description,
    openGraph: {
      title: `${f.family} — Fontory`,
      description,
    },
  };
}

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

  const styleCount = `${f.styles.length} ${f.styles.length === 1 ? "style" : "styles"}`;
  const meta = [
    styleCount,
    f.isVariable ? "Variable" : null,
    ...f.categories.map(categoryLabel),
    f.licenseName,
  ].filter((m): m is string => Boolean(m));

  return (
    <article className="flex flex-col gap-16 md:gap-20">
      <header className="flex flex-col gap-8 md:gap-10">
        <nav aria-label="Breadcrumb">
          <ol className="label-mono flex flex-wrap items-center gap-2">
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

        <div className="flex min-w-0 flex-col gap-5">
          <FamilyName family={f.family} styles={f.styles} weight={preview.previewWeight} style={preview.previewStyle} />
          <div className="flex flex-col gap-2">
            <p className="text-lg text-ink">by {f.designer}</p>
            <p className="label-mono tabular-nums">{meta.join(" · ")}</p>
          </div>
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
          <Link href={`/compare?a=${f.slug}`} className="btn btn-secondary">
            Compare
          </Link>
        </div>
      </header>

      <DetailPreview
        family={f.family}
        styles={f.styles}
        weights={f.weights}
        previewWeight={preview.previewWeight}
        previewStyle={preview.previewStyle}
        variableLabel={variableWeightLabel(f.axes)}
        weightsText={weightsText(f)}
      />

      <CharacterSet
        family={f.family}
        subsets={f.subsets}
        weight={preview.previewWeight}
        style={preview.previewStyle}
      />

      <UseOnWeb
        linkTag={snippet.linkTag}
        importLine={snippet.importLine}
        fontFamilyLine={snippet.fontFamilyLine}
      />

      <InfoPanel font={f} />

      {related.length > 0 && (
        <DetailSection id="related-heading" number="06" title="Related">
          <ul className="grid gap-px border border-rule bg-rule sm:grid-cols-2 xl:grid-cols-3">
            {related.map((e) => (
              <li key={e.slug} className="min-w-0 bg-ground">
                <FontCard font={e} text="" size={32} />
              </li>
            ))}
          </ul>
        </DetailSection>
      )}
    </article>
  );
}
