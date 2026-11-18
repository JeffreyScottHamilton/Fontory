import type { MetadataRoute } from "next";
import { getIndex } from "@/lib/data";
import { siteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const fonts: MetadataRoute.Sitemap = getIndex().map((f) => ({
    url: `${base}/font/${f.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/compare`, changeFrequency: "monthly", priority: 0.5 },
    ...fonts,
  ];
}
