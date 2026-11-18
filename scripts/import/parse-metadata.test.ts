import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseMetadata } from "./parse-metadata";

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");

describe("parseMetadata on real METADATA.pb files", () => {
  it("parses ofl/inter", () => {
    const m = parseMetadata(fixture("ofl-inter-METADATA.pb"));
    expect(m.name).toBe("Inter");
    expect(m.designer).toBe("Rasmus Andersson");
    expect(m.license).toBe("OFL");
    expect(m.categories).toEqual(["SANS_SERIF"]);
    expect(m.dateAdded).toBe("2020-01-24");
    expect(m.fonts).toHaveLength(2);
    expect(m.fonts[0]).toEqual({
      name: "Inter",
      style: "normal",
      weight: 400,
      filename: "Inter[opsz,wght].ttf",
      postScriptName: "Inter-Regular",
      fullName: "Inter Regular",
      copyright: "Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)",
    });
    expect(m.fonts[1].style).toBe("italic");
    expect(m.fonts[1].filename).toBe("Inter-Italic[opsz,wght].ttf");
    expect(m.subsets).toContain("menu");
    expect(m.subsets).toHaveLength(8);
    expect(m.axes).toEqual([
      { tag: "opsz", minValue: 14, maxValue: 32 },
      { tag: "wght", minValue: 100, maxValue: 900 },
    ]);
    expect(m.source).toEqual({
      repositoryUrl: "https://www.github.com/rsms/inter",
      commit: "66647c0bbbe41a850d79d9c76fb13add3378940f",
    });
  });

  it("parses apache/aclonica, ignoring unknown fields", () => {
    const m = parseMetadata(fixture("apache-aclonica-METADATA.pb"));
    expect(m.name).toBe("Aclonica");
    expect(m.license).toBe("APACHE2");
    expect(m.categories).toEqual(["SANS_SERIF"]);
    expect(m.fonts).toHaveLength(1);
    expect(m.axes).toEqual([]);
    expect(m.source).toEqual({ repositoryUrl: "https://github.com/librefonts/aclonica", commit: "2746e457bdb6c42c89faa2803030ba609e935390" });
  });
});

describe("parseMetadata textproto handling", () => {
  it("ignores # comments, including inside what looks like a field", () => {
    const m = parseMetadata(`# name: "Commented"\nname: "Real" # trailing\ndesigner: "D" # x\nlicense: "OFL"\n`);
    expect(m.name).toBe("Real");
    expect(m.designer).toBe("D");
  });

  it("decodes escaped quotes, backslashes and unicode escapes", () => {
    const m = parseMetadata(String.raw`name: "Say \"hi\" \\ ok é"
designer: 'It\'s me'
`);
    expect(m.name).toBe('Say "hi" \\ ok é');
    expect(m.designer).toBe("It's me");
  });

  it("does not treat # inside a string as a comment", () => {
    expect(parseMetadata(`name: "C# Font"\n`).name).toBe("C# Font");
  });

  it("concatenates adjacent string literals", () => {
    expect(parseMetadata(`name: "Long " "Name"\n`).name).toBe("Long Name");
  });

  it("skips unknown nested blocks without leaking their fields", () => {
    const text = [
      `name: "Top"`,
      `mystery { name: "Nope" category: "SERIF" deep { category: "HANDWRITING" } }`,
      `category: "DISPLAY"`,
      `fonts { name: "Top" weight: 700 extra { weight: 1 } }`,
      `source { repository_url: "https://example.com/x" other { commit: "no" } }`,
    ].join("\n");
    const m = parseMetadata(text);
    expect(m.name).toBe("Top");
    expect(m.categories).toEqual(["DISPLAY"]);
    expect(m.fonts).toHaveLength(1);
    expect(m.fonts[0].weight).toBe(700);
    expect(m.source).toEqual({ repositoryUrl: "https://example.com/x", commit: undefined });
  });

  it("collects repeated category lines in order", () => {
    const m = parseMetadata(`category: "SERIF"\ncategory: "MONOSPACE"\n`);
    expect(m.categories).toEqual(["SERIF", "MONOSPACE"]);
  });

  it("accepts angle-bracket message delimiters and list syntax for repeated scalars", () => {
    const m = parseMetadata(`fonts < name: "A" weight: 300 style: "italic" >\nsubsets: ["latin", "menu"]\n`);
    expect(m.fonts[0]).toMatchObject({ name: "A", weight: 300, style: "italic" });
    expect(m.subsets).toEqual(["latin", "menu"]);
  });

  it("leaves missing fields undefined rather than inventing values", () => {
    const m = parseMetadata(`name: "Only"\nfonts { weight: 400 }\n`);
    expect(m.designer).toBeUndefined();
    expect(m.license).toBeUndefined();
    expect(m.dateAdded).toBeUndefined();
    expect(m.source).toBeUndefined();
    expect(m.fonts[0].filename).toBeUndefined();
    expect(m.fonts[0].weight).toBe(400);
  });

  it("throws on unterminated strings and unbalanced braces", () => {
    expect(() => parseMetadata(`name: "oops\n`)).toThrow();
    expect(() => parseMetadata(`fonts { name: "A"\n`)).toThrow();
  });
});
