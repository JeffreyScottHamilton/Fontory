import { describe, expect, it } from "vitest";
import { normalizeFamily, previewFor } from "@/lib/data";
import type { FontFamily, FontStyle } from "@/lib/types";

const st = (weight: number, style: "normal" | "italic" = "normal"): FontStyle => ({
  style,
  weight,
  filename: `f-${weight}-${style}.ttf`,
  fullName: `F ${weight} ${style}`,
  url: "https://example.invalid/f.ttf",
});

describe("previewFor", () => {
  it("prefers normal 400 when present", () => {
    expect(previewFor([st(300), st(400), st(700), st(400, "italic")])).toEqual({
      previewWeight: 400,
      previewStyle: "normal",
    });
  });

  it("uses the normal weight closest to 400 when 400 is missing", () => {
    expect(previewFor([st(100), st(300), st(700)])).toEqual({ previewWeight: 300, previewStyle: "normal" });
    expect(previewFor([st(500), st(900)])).toEqual({ previewWeight: 500, previewStyle: "normal" });
  });

  it("breaks distance ties toward the lower weight", () => {
    expect(previewFor([st(300), st(500)])).toEqual({ previewWeight: 300, previewStyle: "normal" });
  });

  it("falls back to the closest italic when there are no normal faces", () => {
    expect(previewFor([st(200, "italic"), st(600, "italic")])).toEqual({
      previewWeight: 200,
      previewStyle: "italic",
    });
  });
});

describe("normalizeFamily", () => {
  it("defaults preview, collection and source host for records from before the re-import", () => {
    const old = { slug: "inter", source: { repo: "google/fonts", commit: "abc", url: "u" } } as unknown as FontFamily;
    const f = normalizeFamily(old);
    expect(f.preview).toBe("css2");
    expect(f.collection).toBe("google-fonts");
    expect(f.source.host).toBe("github");
    expect(f.source.repo).toBe("google/fonts");
  });

  it("keeps explicit values", () => {
    const f = normalizeFamily({
      slug: "x",
      preview: "fontface",
      collection: "velvetyne",
      source: { repo: "velvetyne/x", commit: "c", url: "u", host: "gitlab" },
    } as unknown as FontFamily);
    expect([f.preview, f.collection, f.source.host]).toEqual(["fontface", "velvetyne", "gitlab"]);
  });
});
