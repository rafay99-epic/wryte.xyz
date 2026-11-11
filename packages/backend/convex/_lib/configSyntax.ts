import { parse as parseToml } from "@decimalturn/toml-patch";
import {
  type ParseError,
  parse as parseJson,
  printParseErrorCode,
} from "jsonc-parser";
import { parseDocument } from "yaml";
import type { ConfigFormat } from "./configFiles";

export type ConfigSyntaxOptions = { jsonComments: boolean };

export type ConfigSyntaxResult =
  | { ok: true; raw: unknown }
  | { ok: false; message: string; line: number | null };

const STRICT: ConfigSyntaxOptions = { jsonComments: false };

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

function parseJsonSyntax(
  text: string,
  options: ConfigSyntaxOptions,
): ConfigSyntaxResult {
  const errors: ParseError[] = [];
  const raw: unknown = parseJson(text, errors, {
    disallowComments: !options.jsonComments,
    allowTrailingComma: options.jsonComments,
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
  return { ok: true, raw };
}

function parseYamlSyntax(text: string): ConfigSyntaxResult {
  const document = parseDocument(text, { prettyErrors: true });
  const first = document.errors[0];
  if (first) {
    return {
      ok: false,
      message:
        first.code === "MULTIPLE_DOCS"
          ? "Files with more than one YAML document can't be edited here"
          : (first.message.split("\n")[0] ?? "Invalid YAML"),
      line: first.linePos?.[0].line ?? null,
    };
  }
  try {
    const raw: unknown = document.toJS();
    return { ok: true, raw };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid YAML";
    return {
      ok: false,
      message: message.split("\n")[0] ?? message,
      line: null,
    };
  }
}

function parseTomlSyntax(text: string): ConfigSyntaxResult {
  try {
    const raw: unknown = parseToml(text);
    return { ok: true, raw };
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

export function usesJsonComments(text: string): boolean {
  return (
    !parseJsonSyntax(text, STRICT).ok &&
    parseJsonSyntax(text, { jsonComments: true }).ok
  );
}

export function parseConfigSyntax(
  text: string,
  format: ConfigFormat,
  options: ConfigSyntaxOptions = STRICT,
): ConfigSyntaxResult {
  if (format === "json") return parseJsonSyntax(text, options);
  if (format === "yaml") return parseYamlSyntax(text);
  return parseTomlSyntax(text);
}
