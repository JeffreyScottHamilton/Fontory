// Minimal protobuf text-format parser for Google Fonts METADATA.pb files.
// Generic over fields: unknown fields and nested blocks are parsed and then ignored.

type Tok =
  | { t: "str"; v: string }
  | { t: "word"; v: string }
  | { t: "punct"; v: string };

type Value =
  | { kind: "string"; value: string }
  | { kind: "scalar"; value: string }
  | { kind: "message"; fields: Field[] };

interface Field { key: string; value: Value }

export interface MetadataFont {
  name?: string;
  style?: string;
  weight?: number;
  filename?: string;
  postScriptName?: string;
  fullName?: string;
  copyright?: string;
}

export interface MetadataAxis { tag: string; minValue?: number; maxValue?: number }

export interface Metadata {
  name?: string;
  designer?: string;
  license?: string;
  categories: string[];
  dateAdded?: string;
  fonts: MetadataFont[];
  subsets: string[];
  axes: MetadataAxis[];
  source?: { repositoryUrl?: string; commit?: string };
}

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", a: "\x07", b: "\b", f: "\f", v: "\v", "\\": "\\", '"': '"', "'": "'", "?": "?" };

function readEscape(src: string, i: number): { text: string; next: number } {
  const c = src[i];
  if (c === undefined) throw new Error("dangling backslash in string");
  if (c in ESCAPES) return { text: ESCAPES[c], next: i + 1 };
  if (c === "x" || c === "X") {
    const m = /^[0-9a-fA-F]{1,2}/.exec(src.slice(i + 1, i + 3));
    if (!m) throw new Error("bad \\x escape");
    return { text: String.fromCharCode(parseInt(m[0], 16)), next: i + 1 + m[0].length };
  }
  if (c === "u" || c === "U") {
    const len = c === "u" ? 4 : 8;
    const hex = src.slice(i + 1, i + 1 + len);
    if (!new RegExp(`^[0-9a-fA-F]{${len}}$`).test(hex)) throw new Error("bad unicode escape");
    return { text: String.fromCodePoint(parseInt(hex, 16)), next: i + 1 + len };
  }
  const oct = /^[0-7]{1,3}/.exec(src.slice(i, i + 3));
  if (oct) return { text: String.fromCharCode(parseInt(oct[0], 8)), next: i + oct[0].length };
  return { text: c, next: i + 1 };
}

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  const word = /[^\s#"'{}<>\[\],:;]+/y;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "#") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (/\s/.test(c)) {
      i++;
    } else if (c === '"' || c === "'") {
      let s = "";
      i++;
      for (;;) {
        if (i >= src.length) throw new Error("unterminated string");
        const ch = src[i];
        if (ch === c) { i++; break; }
        if (ch === "\n") throw new Error("newline inside string");
        if (ch === "\\") {
          const r = readEscape(src, i + 1);
          s += r.text;
          i = r.next;
        } else {
          s += ch;
          i++;
        }
      }
      out.push({ t: "str", v: s });
    } else if ("{}<>[],:;".includes(c)) {
      out.push({ t: "punct", v: c });
      i++;
    } else {
      word.lastIndex = i;
      const m = word.exec(src);
      if (!m) throw new Error(`unexpected character ${JSON.stringify(c)}`);
      out.push({ t: "word", v: m[0] });
      i += m[0].length;
    }
  }
  return out;
}

const isPunct = (t: Tok | undefined, v: string): boolean => t?.t === "punct" && t.v === v;

const closerFor = (open: string): string => (open === "{" ? "}" : ">");

class Parser {
  pos = 0;
  constructor(private readonly toks: Tok[]) {}

  private peek(): Tok | undefined { return this.toks[this.pos]; }

  // Parses fields until `closer` (or EOF when closer is null).
  fields(closer: string | null): Field[] {
    const out: Field[] = [];
    for (;;) {
      const tok = this.peek();
      if (!tok) {
        if (closer !== null) throw new Error(`unterminated block, expected ${closer}`);
        return out;
      }
      if (closer !== null && isPunct(tok, closer)) {
        this.pos++;
        return out;
      }
      if (tok.t === "punct" && (tok.v === "," || tok.v === ";")) { this.pos++; continue; }
      if (isPunct(tok, "[")) { this.skipExtensionName(); continue; }
      if (isPunct(tok, "{") || isPunct(tok, "<")) {
        // Anonymous block at field position: parse and discard.
        this.pos++;
        this.fields(closerFor(tok.t === "punct" ? tok.v : "{"));
        continue;
      }
      if (tok.t !== "word") { this.pos++; continue; } // stray string or punctuation
      this.pos++;
      if (isPunct(this.peek(), ":")) this.pos++;
      out.push(...this.values(tok.v));
    }
  }

  private skipExtensionName(): void {
    this.pos++;
    while (this.peek() && !isPunct(this.peek(), "]")) this.pos++;
    if (!this.peek()) throw new Error("unterminated [extension] name");
    this.pos++;
  }

  // A key carries a single value, a message, or a [list] of values (repeated key).
  private values(key: string): Field[] {
    if (isPunct(this.peek(), "[")) {
      this.pos++;
      const out: Field[] = [];
      for (;;) {
        const t = this.peek();
        if (!t) throw new Error("unterminated list");
        if (isPunct(t, "]")) { this.pos++; return out; }
        if (isPunct(t, ",")) { this.pos++; continue; }
        const v = this.single();
        if (v) out.push({ key, value: v });
        else this.pos++;
      }
    }
    const v = this.single();
    return v ? [{ key, value: v }] : [];
  }

  private single(): Value | null {
    const tok = this.peek();
    if (!tok) return null;
    if (isPunct(tok, "{") || isPunct(tok, "<")) {
      this.pos++;
      return { kind: "message", fields: this.fields(closerFor(tok.t === "punct" ? tok.v : "{")) };
    }
    if (tok.t === "str") {
      let s = "";
      while (this.peek()?.t === "str") s += (this.toks[this.pos++] as { v: string }).v;
      return { kind: "string", value: s };
    }
    if (tok.t === "word") {
      this.pos++;
      return { kind: "scalar", value: tok.v };
    }
    return null;
  }
}

export function parseTextproto(text: string): Field[] {
  return new Parser(tokenize(text)).fields(null);
}

function text(fields: Field[], key: string): string | undefined {
  for (const f of fields) {
    if (f.key === key && f.value.kind !== "message") return f.value.value;
  }
  return undefined;
}

function texts(fields: Field[], key: string): string[] {
  const out: string[] = [];
  for (const f of fields) if (f.key === key && f.value.kind !== "message") out.push(f.value.value);
  return out;
}

function messages(fields: Field[], key: string): Field[][] {
  const out: Field[][] = [];
  for (const f of fields) if (f.key === key && f.value.kind === "message") out.push(f.value.fields);
  return out;
}

function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function parseMetadata(src: string): Metadata {
  const top = parseTextproto(src);

  const fonts: MetadataFont[] = messages(top, "fonts").map((f) => ({
    name: text(f, "name"),
    style: text(f, "style"),
    weight: num(text(f, "weight")),
    filename: text(f, "filename"),
    postScriptName: text(f, "post_script_name"),
    fullName: text(f, "full_name"),
    copyright: text(f, "copyright"),
  }));

  const axes: MetadataAxis[] = messages(top, "axes").map((a) => ({
    tag: text(a, "tag") ?? "",
    minValue: num(text(a, "min_value")),
    maxValue: num(text(a, "max_value")),
  }));

  const srcBlock = messages(top, "source")[0];
  const source = srcBlock
    ? { repositoryUrl: text(srcBlock, "repository_url"), commit: text(srcBlock, "commit") }
    : undefined;

  return {
    name: text(top, "name"),
    designer: text(top, "designer"),
    license: text(top, "license"),
    categories: texts(top, "category"),
    dateAdded: text(top, "date_added"),
    fonts,
    subsets: texts(top, "subsets"),
    axes,
    source,
  };
}
