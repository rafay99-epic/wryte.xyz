type OpenChar = "{" | "[" | "(";
type CloseChar = "}" | "]" | ")";
const PAIRS: Record<OpenChar, CloseChar> = { "{": "}", "[": "]", "(": ")" };

export function extractBalanced(
  src: string,
  openIndex: number,
): { inner: string; endIndex: number } | null {
  const open = src[openIndex] as OpenChar;
  const close = PAIRS[open];
  if (!close) return null;

  let depth = 0;
  let quote: string | null = null;
  for (let i = openIndex; i < src.length; i++) {
    const ch = src[i];

    if (quote) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") {
      depth--;
      if (depth === 0) {
        return { inner: src.slice(openIndex + 1, i), endIndex: i + 1 };
      }
    }
  }
  return null;
}

export function splitTopLevel(body: string, separator = ","): string[] {
  const segments: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];

    if (quote) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    else if (ch === separator && depth === 0) {
      segments.push(body.slice(start, i));
      start = i + 1;
    }
  }
  segments.push(body.slice(start));

  return segments.map((s) => s.trim()).filter((s) => s.length > 0);
}

export function splitKeyValue(
  segment: string,
): { key: string; value: string } | null {
  let depth = 0;
  let quote: string | null = null;

  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];

    if (quote) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    else if (ch === ":" && depth === 0) {
      const rawKey = segment.slice(0, i).trim();
      const value = segment.slice(i + 1).trim();
      const key = rawKey.replace(/^['"`]|['"`]$/g, "");
      if (!key) return null;
      return { key, value };
    }
  }
  return null;
}

export function stripComments(src: string): string {
  let out = "";
  let quote: string | null = null;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (quote) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      continue;
    }

    if (ch === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i++;
      out += " ";
      continue;
    }

    out += ch;
  }

  return out;
}
