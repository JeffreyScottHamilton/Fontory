/**
 * Canonical site origin, without a trailing slash.
 * Order: VERCEL_PROJECT_PRODUCTION_URL (bare host, prefixed with https://),
 * then NEXT_PUBLIC_SITE_URL, then http://localhost:3000.
 */
export function siteUrl(): string {
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelHost) {
    return `https://${vercelHost.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  return "http://localhost:3000";
}
