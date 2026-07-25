import type { FrontmatterFieldType } from "@wryte/logic/types/frontmatter";
import { type AggregatedField, aggregateSamples } from "./aggregate";
import { identifyFramework } from "./frameworks";
import { parseFrontmatter } from "./parse";
import { parseAstroConfig } from "./parsers/astro";
import { parseContentlayerConfig } from "./parsers/contentlayer";
import { parseHugoConfig } from "./parsers/hugo";
import { parseJekyllConfig } from "./parsers/jekyll";
import type {
  ConfigFile,
  ConfigSchema,
  DetectedField,
  DetectionFramework,
  DetectionResult,
  FrontmatterFormat,
  RawSampleFile,
} from "./types";

export { configCandidatePaths, identifyFramework } from "./frameworks";
export type {
  ConfigFile,
  DetectedField,
  DetectionFramework,
  DetectionResult,
  FrontmatterFormat,
  RawSampleFile,
} from "./types";

/** A field present in this fraction of sampled posts is treated as required. */
const REQUIRED_THRESHOLD = 0.8;

export type DetectInput = {
  framework: DetectionFramework;
  /** Framework config/archetype files fetched from the repo (may be empty). */
  configFiles: ConfigFile[];
  /** Raw post files to sample (may be empty). */
  sampleFiles: RawSampleFile[];
  /** Content dir, used to pick the matching Astro collection. */
  contentPath?: string;
};

/**
 * The detection cascade. Framework config (Astro Zod, Contentlayer, Hugo
 * taxonomies, Jekyll defaults) is authoritative; multi-file sample aggregation
 * fills gaps and decides required-ness from real data; a single bad post can no
 * longer poison the schema. Pure and synchronous — all I/O happens in the
 * caller, so this is trivially testable and cheap to run at scale.
 */
export function detectSchema(input: DetectInput): DetectionResult {
  const config = parseConfig(input);

  const parsedSamples: Array<Record<string, unknown>> = [];
  const sampleFormats: FrontmatterFormat[] = [];
  const sampleSources: string[] = [];
  for (const file of input.sampleFiles) {
    const parsed = parseFrontmatter(file.content);
    if (!parsed || Object.keys(parsed.data).length === 0) continue;
    parsedSamples.push(parsed.data);
    sampleFormats.push(parsed.format);
    sampleSources.push(file.path);
  }

  const aggregated = aggregateSamples(parsedSamples);
  const fields = mergeFields(config, aggregated);

  const configSources = config ? usedConfigPaths(input) : [];
  const basis: DetectionResult["basis"] =
    fields.length === 0
      ? "none"
      : config && parsedSamples.length > 0
        ? "mixed"
        : config
          ? "framework-config"
          : "samples";

  return {
    fields,
    framework: input.framework,
    frontmatterFormat: dominantFormat(sampleFormats),
    sources: [...configSources, ...sampleSources],
    sampledCount: parsedSamples.length,
    basis,
  };
}

function parseConfig(input: DetectInput): ConfigSchema | null {
  const { framework, configFiles, contentPath } = input;
  if (configFiles.length === 0) return null;

  switch (framework) {
    case "astro":
      return firstParsed(configFiles, (f) =>
        parseAstroConfig(f.content, contentPath),
      );
    case "nextjs":
      return firstParsed(configFiles, (f) =>
        parseContentlayerConfig(f.content),
      );
    case "hugo":
      return parseHugoConfig(configFiles);
    case "jekyll":
      return firstParsed(configFiles, (f) => parseJekyllConfig(f.content));
    default:
      return null;
  }
}

function firstParsed(
  files: ConfigFile[],
  parser: (f: ConfigFile) => ConfigSchema | null,
): ConfigSchema | null {
  for (const file of files) {
    const result = parser(file);
    if (result && result.size > 0) return result;
  }
  return null;
}

/** Config files always inform the result when a config parsed successfully. */
function usedConfigPaths(input: DetectInput): string[] {
  return input.configFiles.map((f) => f.path);
}

/**
 * Combines the authoritative config schema with sample evidence into the final
 * ordered field list. Config order comes first (matches the source), then any
 * fields seen only in posts, in first-seen order.
 */
function mergeFields(
  config: ConfigSchema | null,
  aggregated: Map<string, AggregatedField>,
): DetectedField[] {
  const order: string[] = [];
  const seen = new Set<string>();

  if (config) {
    for (const key of config.keys()) {
      order.push(key);
      seen.add(key);
    }
  }
  const sampleOnly = [...aggregated.entries()]
    .filter(([key]) => !seen.has(key))
    .sort((a, b) => a[1].firstSeenIndex - b[1].firstSeenIndex)
    .map(([key]) => key);
  order.push(...sampleOnly);

  const fields: DetectedField[] = [];
  for (const key of order) {
    const configField = config?.get(key);
    const agg = aggregated.get(key);

    let type: FrontmatterFieldType = "string";
    if (configField && agg) {
      // Trust a confidently-typed config field; if the config parser fell back
      // to "string", let real-post evidence override it.
      type = configField.type !== "string" ? configField.type : agg.type;
    } else if (configField) {
      type = configField.type;
    } else if (agg) {
      type = agg.type;
    }

    const required = configField
      ? configField.required
      : (agg?.presenceRatio ?? 0) >= REQUIRED_THRESHOLD;

    fields.push({
      name: key,
      type,
      required,
      // Never copy a sampled post's values — detection learns shape, not content.
      defaultValue: "",
      options: configField?.options ?? "",
    });
  }

  return fields;
}

function dominantFormat(formats: FrontmatterFormat[]): FrontmatterFormat {
  const toml = formats.filter((f) => f === "toml").length;
  return toml > formats.length - toml ? "toml" : "yaml";
}

/**
 * Convenience overload of {@link detectSchema} that also identifies the
 * framework from the repo file list when the caller hasn't already.
 */
export function detectSchemaFromRepo(
  args: Omit<DetectInput, "framework"> & { allPaths: string[] },
): DetectionResult {
  return detectSchema({
    framework: identifyFramework(args.allPaths),
    configFiles: args.configFiles,
    sampleFiles: args.sampleFiles,
    ...(args.contentPath !== undefined
      ? { contentPath: args.contentPath }
      : {}),
  });
}
