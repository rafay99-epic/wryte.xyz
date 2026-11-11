import { parse as parseToml } from "@decimalturn/toml-patch";
import type { ConfigFormat } from "@wryte/backend/_lib/configFiles";
import {
  type ParseError,
  parse as parseJson,
  printParseErrorCode,
} from "jsonc-parser";
import { parseDocument } from "yaml";
import { type ConfigValue, toConfigValue } from "./value";

export type ConfigParseResult =
  | { ok: true; value: ConfigValue }
  | { ok: false; message: string; line: number | null };

const JSON_ERROR_TEXT: Record<string, string> = {
  InvalidSymbol: "Unexpected character",
  InvalidNumberFormat: "Invalid number",
  PropertyNameExpected: "Expected a quoted property name",
  ValueExpected: "Expected a value",
  ColonExpected: "Expected a colon",
  CommaExpected: "Expected a comma",
  CloseBraceExpected: "Expected a closing brace",
  CloseBracketExpected: "Expected a closing bracket",
  EndOfFileExpected: "Unexpected content after the end of the document",
  InvalidCommentToken: "Comments are not allowed in JSON",
  UnexpectedEndOfComment: "Unterminated comment",
  UnexpectedEndOfString: "Unterminated string",
  UnexpectedEndOfNumber: "Unterminated number",
  InvalidUnicode: "Invalid unicode escape",
  InvalidEscapeCharacter: "Invalid escape character",
  InvalidCharacter: "Invalid character in string",
};

function lineAt(text: string, offset: number): number {
  let line = 1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

function parseJsonConfig(text: string): ConfigParseResult {
  const errors: ParseError[] = [];
  const raw: unknown = parseJson(text, errors, {
    disallowComments: true,
    allowTrailingComma: false,
    allowEmptyContent: false,
  });
  const first = errors[0];
  if (first) {
    const code = printParseErrorCode(first.error);
    return {
      ok: false,
      message: JSON_ERROR_TEXT[code] ?? "Invalid JSON",
      line: lineAt(text, first.offset),
    };
  }
  return { ok: true, value: toConfigValue(raw) };
}

function parseYamlConfig(text: string): ConfigParseResult {
  const document = parseDocument(text, { prettyErrors: true });
  const first = document.errors[0];
  if (first) {
    return {
      ok: false,
      message: first.message.split("\n")[0] ?? "Invalid YAML",
      line: first.linePos?.[0].line ?? null,
    };
  }
  return { ok: true, value: toConfigValue(document.toJS()) };
}

function parseTomlConfig(text: string): ConfigParseResult {
  try {
    return { ok: true, value: toConfigValue(parseToml(text)) };
  } catch (error: unknown) {
    const line =
      typeof error === "object" &&
      error !== null &&
      "line" in error &&
      typeof error.line === "number"
        ? error.line
        : null;
    const message = error instanceof Error ? error.message : "Invalid TOML";
    return { ok: false, message: message.split("\n")[0] ?? message, line };
  }
}

export function parseConfig(
  text: string,
  format: ConfigFormat,
): ConfigParseResult {
  if (format === "json") return parseJsonConfig(text);
  if (format === "yaml") return parseYamlConfig(text);
  return parseTomlConfig(text);
}
