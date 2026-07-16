/**
 * Commit attribution + commit message templating.
 *
 * Every content commit Wryte creates can carry a short attribution line
 * linking back to the app ("Published with Wryte (https://wryte.xyz/gh)").
 * This module owns that line end to end: template substitution, validation
 * of the per-project custom phrase, and idempotent appending.
 *
 * Pure TypeScript with no Convex/runtime imports so it can be shared by
 * Convex actions and client components (e.g. the publish dialog preview).
 */

/** Vanity redirect that carries UTM params — keep commits clean of query strings. */
export const ATTRIBUTION_URL = "https://wryte.xyz/gh";

export const DEFAULT_ATTRIBUTION_TEXT = "Published with Wryte";

/**
 * Registered GitHub App bot identity (App ID 4318946, "wryte-xyz",
 * github.com/apps/wryte-xyz). The email must be GitHub's generated
 * `<user id>+<login>@users.noreply.github.com` form or the avatar
 * silently never renders on co-authored commits.
 */
export const ATTRIBUTION_CO_AUTHOR =
  "wryte-xyz[bot] <306009654+wryte-xyz[bot]@users.noreply.github.com>";

export type CommitTemplateVars = {
  title: string;
  slug: string;
  filename: string;
  date: string;
};

/** Replaces {{title}}, {{slug}}, {{filename}}, {{date}} in a template. */
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

/**
 * Validates a custom attribution phrase before it is stored.
 * Returns an error message, or null when valid.
 *
 * The phrase ends up inside git commit metadata, so this is a trust
 * boundary: reject multi-line values and anything shaped like a git
 * trailer key (`Co-authored-by:`, `Signed-off-by:`, …) to prevent
 * commit-trailer injection through a settings field.
 */
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

/** The exact line appended to commit messages, e.g. for dialog previews. */
export function attributionLine(customText?: string): string {
  const phrase = customText?.trim() || DEFAULT_ATTRIBUTION_TEXT;
  return `${phrase} (${ATTRIBUTION_URL})`;
}

/**
 * Appends the attribution block to a commit message.
 *
 * Idempotent: if the attribution URL is already present (publish retries,
 * republish of a stored message), the message is returned unchanged.
 */
export function withAttribution(
  message: string,
  opts: {
    /** projects.commitAttribution — absent/true = on, false = off */
    enabled: boolean;
    /** projects.commitAttributionText — validated custom phrase */
    customText?: string | undefined;
    /** Template vars applied to the custom phrase (same as the message). */
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
  // Re-validate at use time: stored values predate the rule or were written
  // by other clients of the open API. Fall back rather than commit bad data.
  if (validateAttributionText(phrase) !== null) {
    phrase = DEFAULT_ATTRIBUTION_TEXT;
  }

  // The co-author trailer sits in its own final paragraph, per git trailer
  // conventions — GitHub renders the bot's avatar next to the author's.
  const coAuthor = ATTRIBUTION_CO_AUTHOR
    ? `\n\nCo-authored-by: ${ATTRIBUTION_CO_AUTHOR}`
    : "";
  return `${base}\n\n${phrase} (${ATTRIBUTION_URL})${coAuthor}`;
}
