export const ATTRIBUTION_URL = "https://wryte.xyz/gh";

export const DEFAULT_ATTRIBUTION_TEXT = "Published with Wryte";

export const ATTRIBUTION_CO_AUTHOR =
  "wryte-xyz[bot] <306009654+wryte-xyz[bot]@users.noreply.github.com>";

export type CommitTemplateVars = {
  title: string;
  slug: string;
  filename: string;
  date: string;
};

export function renderCommitTemplate(
  template: string,
  vars: CommitTemplateVars,
): string {
  return template
    .replaceAll("{{title}}", vars.title)
    .replaceAll("{{slug}}", vars.slug)
    .replaceAll("{{filename}}", vars.filename)
    .replaceAll("{{date}}", vars.date);
}

export const ATTRIBUTION_TEXT_MAX_LENGTH = 100;

export function validateAttributionText(text: string): string | null {
  if (/[\r\n]/.test(text)) {
    return "Attribution text must be a single line";
  }
  if (text.length > ATTRIBUTION_TEXT_MAX_LENGTH) {
    return `Attribution text must be at most ${ATTRIBUTION_TEXT_MAX_LENGTH} characters`;
  }
  if (/^\s*[\w-]+:/.test(text)) {
    return "Attribution text must not start with a git trailer key (e.g. “Co-authored-by:”)";
  }
  return null;
}

export function attributionLine(customText?: string): string {
  const phrase = customText?.trim() || DEFAULT_ATTRIBUTION_TEXT;
  return `${phrase} (${ATTRIBUTION_URL})`;
}

export function withAttribution(
  message: string,
  opts: {
    enabled: boolean;
    customText?: string | undefined;
    vars?: CommitTemplateVars | undefined;
  },
): string {
  const base = message.trimEnd();
  if (!opts.enabled || base.includes(ATTRIBUTION_URL)) {
    return base;
  }

  let phrase = opts.customText?.trim() || DEFAULT_ATTRIBUTION_TEXT;
  if (opts.vars) {
    phrase = renderCommitTemplate(phrase, opts.vars);
  }
  if (validateAttributionText(phrase) !== null) {
    phrase = DEFAULT_ATTRIBUTION_TEXT;
  }

  const coAuthor = ATTRIBUTION_CO_AUTHOR
    ? `\n\nCo-authored-by: ${ATTRIBUTION_CO_AUTHOR}`
    : "";
  return `${base}\n\n${phrase} (${ATTRIBUTION_URL})${coAuthor}`;
}
