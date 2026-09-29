const MAX_ANIMATION_NAME = 60;
const MAX_ANIMATION_SOURCE = 100_000;

export const ANIMATION_NAME_RE = /^[A-Z][A-Za-z0-9]*$/;

const RESERVED_NAMES = new Set(["Fragment", "React", "Component", "Suspense"]);

export function normalizeAnimationName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new Error("Component name is required");
  if (name.length > MAX_ANIMATION_NAME) {
    throw new Error(
      `Component name must be ${String(MAX_ANIMATION_NAME)} characters or fewer`,
    );
  }
  if (!ANIMATION_NAME_RE.test(name)) {
    throw new Error(
      "Component name must be PascalCase — start with a capital letter, letters and digits only (e.g. HarnessLoop)",
    );
  }
  if (RESERVED_NAMES.has(name)) {
    throw new Error(`"${name}" is a reserved name — pick another`);
  }
  return name;
}

export function validateAnimationSource(raw: string): string {
  if (!raw.trim()) throw new Error("Component source is required");
  if (raw.length > MAX_ANIMATION_SOURCE) {
    throw new Error(
      `Component source must be ${String(MAX_ANIMATION_SOURCE)} characters or fewer`,
    );
  }
  return raw;
}
