export const ANIMATION_LANGUAGES = ["tsx", "jsx"] as const;

export type AnimationLanguage = (typeof ANIMATION_LANGUAGES)[number];

/** Absent means TypeScript: the default every project starts on. */
export function resolveAnimationLanguage(
  language: string | undefined,
): AnimationLanguage {
  return language === "jsx" ? "jsx" : "tsx";
}

export const ANIMATION_CHECK_LEVELS = ["off", "contract", "strict"] as const;

export type AnimationCheckLevel = (typeof ANIMATION_CHECK_LEVELS)[number];

export type DiagnosticSeverity = "error" | "warning";

export type AnimationDiagnostic = {
  rule: string;
  severity: DiagnosticSeverity;
  message: string;
  line: number;
  column: number;
};

export type AnimationCheckOutcome =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "unavailable"; reason: string }
  | { kind: "checked"; diagnostics: readonly AnimationDiagnostic[] };

export type AnimationCheckStatus = "pass" | "warn" | "fail";

export type AnimationCheckRecord = {
  sourceHash: string;
  status: AnimationCheckStatus;
  errorCount: number;
  warningCount: number;
  checkedAt: number;
};

export function hashAnimationSource(source: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function summarizeDiagnostics(
  diagnostics: readonly AnimationDiagnostic[],
): { status: AnimationCheckStatus; errorCount: number; warningCount: number } {
  let errorCount = 0;
  let warningCount = 0;
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") errorCount++;
    else warningCount++;
  }
  const status: AnimationCheckStatus =
    errorCount > 0 ? "fail" : warningCount > 0 ? "warn" : "pass";
  return { status, errorCount, warningCount };
}

export function isCheckCurrent(
  record: AnimationCheckRecord | undefined,
  source: string,
): record is AnimationCheckRecord {
  return (
    record !== undefined && record.sourceHash === hashAnimationSource(source)
  );
}

export type PublishBlocker = {
  name: string;
  reason: "stale" | "failing";
  errorCount: number;
};

export function findPublishBlockers(
  level: AnimationCheckLevel,
  animations: readonly {
    name: string;
    source: string;
    check?: AnimationCheckRecord | undefined;
  }[],
): PublishBlocker[] {
  if (level === "off") return [];

  const blockers: PublishBlocker[] = [];
  for (const animation of animations) {
    if (!isCheckCurrent(animation.check, animation.source)) {
      blockers.push({ name: animation.name, reason: "stale", errorCount: 0 });
      continue;
    }
    if (animation.check.status === "fail") {
      blockers.push({
        name: animation.name,
        reason: "failing",
        errorCount: animation.check.errorCount,
      });
    }
  }
  return blockers;
}

export function describePublishBlockers(
  blockers: readonly PublishBlocker[],
): string {
  const stale = blockers.filter((b) => b.reason === "stale").map((b) => b.name);
  const failing = blockers.filter((b) => b.reason === "failing");

  const parts: string[] = [];
  if (failing.length > 0) {
    parts.push(
      failing
        .map(
          (b) =>
            `${b.name} (${String(b.errorCount)} error${b.errorCount === 1 ? "" : "s"})`,
        )
        .join(", "),
    );
  }
  if (stale.length > 0) {
    parts.push(`${stale.join(", ")} not checked since last edit`);
  }
  return `Animation checks blocked this publish: ${parts.join("; ")}. Open each animation in the gallery to review, or lower the check level in project settings.`;
}
