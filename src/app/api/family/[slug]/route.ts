import { getAllFamilies, getFamily } from "@/lib/data";

// Static JSON per family, prerendered at build time. Used client-side for quick downloads.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllFamilies().map((f) => ({ slug: f.slug }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const family = getFamily(slug);
  if (!family) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(family);
}
