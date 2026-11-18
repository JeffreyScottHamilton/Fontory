/**
 * Canonical site origin, without a trailing slash.
 * Order, first non-empty wins:
 *   1. NEXT_PUBLIC_SITE_URL (trimmed, trailing slashes removed; https:// added if no scheme)
 *   2. VERCEL_PROJECT_PRODUCTION_URL (bare host, prefixed with https://)
 *   3. http://localhost:3000
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    const withoutSlashes = explicit.replace(/\/+$/, "");
    return /^https?:\/\//i.test(withoutSlashes) ? withoutSlashes : `https://${withoutSlashes}`;
  }
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelHost) {
    return `https://${vercelHost.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }
  return "http://localhost:3000";
}
