import { describe, expect, it } from "vitest";
import { DEFAULT_HOME_STATE, buildHomeSearch, parseHomeParams } from "@/components/home/url-state";

describe("parseHomeParams", () => {
  it("returns defaults for an empty query string", () => {
    expect(parseHomeParams("")).toEqual(DEFAULT_HOME_STATE);
  });

  it("drops unknown categories and duplicates", () => {
    const state = parseHomeParams("?c=serif,nope,serif,pixel");
    expect(state.categories).toEqual(["serif", "pixel"]);
  });

  it("validates sort and flags", () => {
    const state = parseHomeParams("?sort=bogus&italic=1&variable=0");
    expect(state.sort).toBe("az");
    expect(state.italic).toBe(true);
    expect(state.variable).toBe(false);
    expect(parseHomeParams("?sort=styles").sort).toBe("styles");
  });

  it("caps the query length", () => {
    expect(parseHomeParams(`?q=${"a".repeat(500)}`).q).toHaveLength(200);
  });
});

describe("buildHomeSearch", () => {
  it("writes nothing for default state", () => {
    expect(buildHomeSearch(DEFAULT_HOME_STATE)).toBe("");
  });

  it("round-trips non-default state with categories in canonical order", () => {
    const state = {
      q: "  inter ",
      categories: ["serif" as const, "pixel" as const],
      italic: true,
      variable: true,
      sort: "newest" as const,
    };
    const search = buildHomeSearch(state);
    expect(search).toBe("q=inter&c=serif%2Cpixel&italic=1&variable=1&sort=newest");
    expect(parseHomeParams(`?${search}`)).toEqual({ ...state, q: "inter" });
  });
});
