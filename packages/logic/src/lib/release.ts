/**
 * Release identity.
 *
 * `APP_BUILD_SHA` is the source of truth — it's the git commit SHA, changes
 * on every deploy automatically, and is what `use-version-check` compares to
 * decide whether to prompt a refresh. Nothing to bump by hand.
 *
 * `APP_VERSION` is a cosmetic, optional label (the `version` in package.json).
 * Bump it whenever you feel like marking a milestone — or never. It is allowed
 * to go stale and is NOT used for update detection.
 */
export const APP_VERSION = process.env["NEXT_PUBLIC_APP_VERSION"] ?? "0.0.0";

export const APP_BUILD = process.env["NEXT_PUBLIC_BUILD_NUMBER"] ?? "dev";

export const APP_BUILD_SHA = process.env["NEXT_PUBLIC_BUILD_SHA"] ?? "dev";

export const APP_VERSION_LABEL = `v${APP_VERSION}`;

export const APP_RELEASE_LABEL = `${APP_VERSION_LABEL} · build ${APP_BUILD}`;
