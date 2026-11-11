import type { ConfigFormat } from "@wryte/backend/_lib/configFiles";
import {
  type ConfigSyntaxOptions,
  parseConfigSyntax,
} from "@wryte/backend/_lib/configSyntax";
import { type ConfigValue, toConfigValue } from "./value";

export { usesJsonComments } from "@wryte/backend/_lib/configSyntax";

export type ConfigParseResult =
  | { ok: true; value: ConfigValue }
  | { ok: false; message: string; line: number | null };

export type ConfigParseOptions = ConfigSyntaxOptions;

export function parseConfig(
  text: string,
  format: ConfigFormat,
  options?: ConfigParseOptions,
): ConfigParseResult {
  const result = parseConfigSyntax(text, format, options);
  return result.ok ? { ok: true, value: toConfigValue(result.raw) } : result;
}
