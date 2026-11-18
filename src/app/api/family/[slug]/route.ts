import { getFamily } from "@/lib/data";
import { PRERENDER_SLUGS } from "@/lib/prerender";

// Family JSON, cached indefinitely after the first request (the data only changes on redeploy).
// Only PRERENDER_SLUGS are prerendered at build time (see src/lib/prerender.ts). Other slugs
// render on first request.

// force-static is the documented way to get ISR for paths generated at runtime.
export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = false;

export function generateStaticParams() {
  return PRERENDER_SLUGS.filter((slug) => getFamily(slug) !== undefined).map((slug) => ({ slug }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const family = getFamily(slug);
  if (!family) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(family);
}
