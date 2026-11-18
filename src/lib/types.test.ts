import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/types";

describe("CATEGORIES", () => {
  it("has 9 unique category ids", () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(ids).toHaveLength(9);
    expect(new Set(ids).size).toBe(9);
  });
});
