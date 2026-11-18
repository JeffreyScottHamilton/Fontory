import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // src/lib/data.ts reads data/fonts.json with fs at runtime, which file tracing cannot see.
  // Brackets are escaped because keys are picomatch route globs.
  outputFileTracingIncludes: {
    "/font/\\[slug\\]": ["./data/fonts.json"],
    "/api/family/\\[slug\\]": ["./data/fonts.json"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
