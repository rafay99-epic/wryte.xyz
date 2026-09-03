import type { AnimationLanguage } from "@wryte/backend/_lib/animationChecks";

const TSX_STARTER = `import { useEffect, useRef, useState } from "react";

const STYLE_ID = "starter-sequence-styles";
const CSS = \`
.seq-wrap {
  --seq-bg: #1a1b26;
  --seq-line: #3b4261;
  --seq-text: #c0caf5;
  --seq-muted: #737aa2;
  --seq-signal: #7aa2f7;

  background: var(--seq-bg);
  border: 1px solid var(--seq-line);
  border-radius: 14px;
  padding: 22px;
  margin: 2rem 0;
  color: var(--seq-text);
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.seq-wrap * { box-sizing: border-box; }
.seq-rail { display: flex; gap: 6px; }
.seq-tick {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: var(--seq-line);
  transition: background 0.4s ease;
}
.seq-tick[data-on="true"] { background: var(--seq-signal); }
.seq-label {
  margin: 16px 0 4px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--seq-signal);
}
.seq-detail { margin: 0; font-size: 14px; color: var(--seq-muted); }
\`;

type Stage = { label: string; detail: string };

const STAGES = [
  { label: "Parse", detail: "The source is read into a syntax tree." },
  { label: "Check", detail: "Types are resolved and every reference verified." },
  { label: "Emit", detail: "The tree is lowered to plain JavaScript." },
] as const satisfies readonly Stage[];

const STEP_MS = 2000;

function useInjectedStyles(): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }, []);
}

function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (node === null || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function StarterSequence() {
  useInjectedStyles();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!inView || prefersReducedMotion()) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % STAGES.length);
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [inView]);

  const stage = STAGES[index] ?? STAGES[0];

  return (
    <div ref={ref} className="seq-wrap">
      <div className="seq-rail">
        {STAGES.map((entry, position) => (
          <span
            key={entry.label}
            className="seq-tick"
            data-on={position <= index}
          />
        ))}
      </div>
      <p className="seq-label">{stage.label}</p>
      <p className="seq-detail">{stage.detail}</p>
    </div>
  );
}
`;

const JSX_STARTER = `import { useEffect, useRef, useState } from "react";

const STYLE_ID = "starter-sequence-styles";
const CSS = \`
.seq-wrap {
  --seq-bg: #1a1b26;
  --seq-line: #3b4261;
  --seq-text: #c0caf5;
  --seq-muted: #737aa2;
  --seq-signal: #7aa2f7;

  background: var(--seq-bg);
  border: 1px solid var(--seq-line);
  border-radius: 14px;
  padding: 22px;
  margin: 2rem 0;
  color: var(--seq-text);
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.seq-wrap * { box-sizing: border-box; }
.seq-rail { display: flex; gap: 6px; }
.seq-tick {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: var(--seq-line);
  transition: background 0.4s ease;
}
.seq-tick[data-on="true"] { background: var(--seq-signal); }
.seq-label {
  margin: 16px 0 4px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--seq-signal);
}
.seq-detail { margin: 0; font-size: 14px; color: var(--seq-muted); }
\`;

const STAGES = [
  { label: "Parse", detail: "The source is read into a syntax tree." },
  { label: "Check", detail: "Types are resolved and every reference verified." },
  { label: "Emit", detail: "The tree is lowered to plain JavaScript." },
];

const STEP_MS = 2000;

function useInjectedStyles() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }, []);
}

function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (node === null || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function StarterSequence() {
  useInjectedStyles();
  const { ref, inView } = useInView();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!inView || prefersReducedMotion()) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % STAGES.length);
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [inView]);

  const stage = STAGES[index] ?? STAGES[0];

  return (
    <div ref={ref} className="seq-wrap">
      <div className="seq-rail">
        {STAGES.map((entry, position) => (
          <span
            key={entry.label}
            className="seq-tick"
            data-on={position <= index}
          />
        ))}
      </div>
      <p className="seq-label">{stage.label}</p>
      <p className="seq-detail">{stage.detail}</p>
    </div>
  );
}
`;

export function starterSource(language: AnimationLanguage): string {
  return language === "jsx" ? JSX_STARTER : TSX_STARTER;
}
