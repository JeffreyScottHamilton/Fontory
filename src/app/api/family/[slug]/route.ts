import { getFamily } from "@/lib/data";

// Family JSON, cached indefinitely after the first request (the data only changes on redeploy).
// Only these slugs are prerendered at build time. Other slugs render on first request.
// Keep in sync with the list in src/app/font/[slug]/page.tsx.
const PRERENDER_SLUGS = [
  "inter",
  "roboto",
  "playfair-display",
  "jetbrains-mono",
  "fira-code",
  "ibm-plex-sans",
  "open-sans",
  "lato",
  "montserrat",
  "poppins",
  "source-sans-3",
  "raleway",
  "merriweather",
  "lora",
  "nunito",
  "oswald",
  "space-grotesk",
  "dm-sans",
  "work-sans",
  "pt-sans",
  "noto-sans",
  "roboto-mono",
  "source-code-pro",
  "ubuntu",
];

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
