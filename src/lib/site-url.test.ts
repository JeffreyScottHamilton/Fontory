import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "./site-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL, trimmed, without trailing slashes", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "  https://fonts.example.com//  ");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "fontory.vercel.app");
    expect(siteUrl()).toBe("https://fonts.example.com");
  });

  it("prefixes https:// when NEXT_PUBLIC_SITE_URL has no scheme", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "fontory.app/");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteUrl()).toBe("https://fontory.app");
  });

  it("falls back to VERCEL_PROJECT_PRODUCTION_URL as a bare host", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "fontory.vercel.app/");
    expect(siteUrl()).toBe("https://fontory.vercel.app");
  });

  it("falls back to http://localhost:3000 when neither is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
