/**
 * Hemingway-style prose lint (pure, framework-free). Five advisory checks —
 * passive voice, adverb density, sentence-length variance, weasel words, and
 * clichés — over a plain content string. All offsets are character indices
 * into the exact input string, so the panel can select-and-jump the same way
 * the readability lens does.
 *
 * Reuses the readability lens's segmentation + heuristics (masked code
 * ranges, sentence splitting, the be-verb/participle/adverb heuristics)
 * rather than re-implementing them — see `readability/segment.ts` and
 * `readability/heuristics.ts`.
 */

import { isAdverb, isBeVerb, isPastParticiple } from "./readability/heuristics";
import {
  type CodeRange,
  findCodeRanges,
  maskCode,
  type SentenceRange,
  splitSentences,
  tokenizeWords,
  type WordToken,
} from "./readability/segment";

export type StyleLintCheckId =
  | "passive-voice"
  | "adverb-density"
  | "sentence-variance"
  | "weasel-words"
  | "cliches";

export type StyleLintFindingKind =
  | "passive"
  | "adverb"
  | "monotony"
  | "long-sentence"
  | "weasel"
  | "cliche";

export type StyleLintSeverity = "warn" | "info";

export type StyleLintFinding = {
  kind: StyleLintFindingKind;
  message: string;
  severity: StyleLintSeverity;
  /** Short, human-readable snippet for the panel's expandable list. */
  excerpt: string;
  /** Character offsets into the original (unmasked) content string. */
  start: number;
  end: number;
};

export type StyleLintCheckMeta = {
  id: StyleLintCheckId;
  label: string;
  kinds: StyleLintFindingKind[];
};

/** Metadata the panel uses to render one toggleable row per check. */
export const STYLE_LINT_CHECKS: StyleLintCheckMeta[] = [
  { id: "passive-voice", label: "Passive voice", kinds: ["passive"] },
  { id: "adverb-density", label: "Adverbs", kinds: ["adverb"] },
  {
    id: "sentence-variance",
    label: "Sentence variety",
    kinds: ["monotony", "long-sentence"],
  },
  { id: "weasel-words", label: "Weasel words", kinds: ["weasel"] },
  { id: "cliches", label: "Clichés", kinds: ["cliche"] },
];

const KIND_TO_CHECK: Record<StyleLintFindingKind, StyleLintCheckId> = {
  passive: "passive-voice",
  adverb: "adverb-density",
  monotony: "sentence-variance",
  "long-sentence": "sentence-variance",
  weasel: "weasel-words",
  cliche: "cliches",
};

export function checkIdForKind(kind: StyleLintFindingKind): StyleLintCheckId {
  return KIND_TO_CHECK[kind];
}

/* ────────────────────────── text preparation ────────────────────────── */

/** Leading `---\n...\n---` frontmatter block, if present at the very start. */
const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
function findFrontmatterRange(text: string): CodeRange[] {
  const m = FRONTMATTER_RE.exec(text);
  return m ? [{ start: 0, end: m[0].length }] : [];
}

/** Bare http(s) URLs — including inside markdown link targets. */
const URL_RE = /\bhttps?:\/\/[^\s)>\]"']+/g;
function findUrlRanges(text: string): CodeRange[] {
  const ranges: CodeRange[] = [];
  URL_RE.lastIndex = 0;
  let m = URL_RE.exec(text);
  while (m !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
    m = URL_RE.exec(text);
  }
  return ranges;
}

/**
 * Mask frontmatter, fenced/inline code, and URLs to spaces (newlines kept)
 * so none of them are analyzed, while every remaining character keeps its
 * original offset into `text`.
 */
export function stripForAnalysis(text: string): string {
  const ranges = [
    ...findFrontmatterRange(text),
    ...findCodeRanges(text),
    ...findUrlRanges(text),
  ].sort((a, b) => a.start - b.start);
  return maskCode(text, ranges);
}

/* ────────────────────────── shared helpers ────────────────────────── */

function truncate(raw: string, maxLen = 140): string {
  const clean = raw.replace(/\s+/g, " ").trim();
  return clean.length <= maxLen
    ? clean
    : `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}

/** Excerpt for a finding whose start/end already spans what to show. */
function excerptForSpan(original: string, start: number, end: number): string {
  return truncate(original.slice(start, end));
}

function sentenceContaining(
  sentences: SentenceRange[],
  pos: number,
): SentenceRange | null {
  for (const s of sentences) {
    if (pos >= s.start && pos < s.end) return s;
  }
  return null;
}

/** Excerpt for a word/phrase-level finding: the sentence around it. */
function excerptForPoint(
  original: string,
  pos: number,
  sentences: SentenceRange[],
): string {
  const s = sentenceContaining(sentences, pos);
  if (s) return truncate(original.slice(s.start, s.end));
  const start = Math.max(0, pos - 40);
  const end = Math.min(original.length, pos + 40);
  return truncate(original.slice(start, end));
}

type LintContext = {
  masked: string;
  words: WordToken[];
  sentences: SentenceRange[];
};

function buildContext(content: string): LintContext {
  const masked = stripForAnalysis(content);
  return {
    masked,
    words: tokenizeWords(masked),
    sentences: splitSentences(masked),
  };
}

/* ────────────────────────── a. passive voice ────────────────────────── */

/** A be-verb followed within 3 words by a past participle. */
function checkPassiveVoiceImpl(
  content: string,
  { words, sentences }: LintContext,
): StyleLintFinding[] {
  const findings: StyleLintFinding[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w || !isBeVerb(w.text)) continue;
    for (let j = i + 1; j <= i + 3 && j < words.length; j++) {
      const cand = words[j];
      if (cand && isPastParticiple(cand.text)) {
        const start = w.start;
        const end = cand.end;
        findings.push({
          kind: "passive",
          severity: "warn",
          message: `Passive voice: "${content.slice(start, end)}" — consider naming the actor.`,
          excerpt: excerptForPoint(content, start, sentences),
          start,
          end,
        });
        break;
      }
    }
  }
  return findings;
}

export function checkPassiveVoice(content: string): StyleLintFinding[] {
  return checkPassiveVoiceImpl(content, buildContext(content));
}

/* ────────────────────────── b. adverb density ────────────────────────── */

/** Flag every `-ly` adverb once overall density exceeds ~1 per 40 words. */
const ADVERB_DENSITY_THRESHOLD = 1 / 40;

function checkAdverbDensityImpl(
  content: string,
  { words, sentences }: LintContext,
): StyleLintFinding[] {
  if (words.length === 0) return [];
  const offenders = words.filter((w) => isAdverb(w.text));
  if (offenders.length === 0) return [];
  const density = offenders.length / words.length;
  if (density <= ADVERB_DENSITY_THRESHOLD) return [];

  const ratio = Math.round(words.length / offenders.length);
  return offenders.map((w) => ({
    kind: "adverb" as const,
    severity: "warn" as const,
    message: `Adverb: "${w.text}" — ${offenders.length} adverbs in ${words.length} words (~1 per ${ratio}). Cut or replace with a stronger verb.`,
    excerpt: excerptForPoint(content, w.start, sentences),
    start: w.start,
    end: w.end,
  }));
}

export function checkAdverbDensity(content: string): StyleLintFinding[] {
  return checkAdverbDensityImpl(content, buildContext(content));
}

/* ─────────────────── c. sentence-length variance ─────────────────── */

const LONG_SENTENCE_WORDS = 35;
const MONOTONY_MIN_RUN = 3;
const MONOTONY_BAND = 3;

function sentenceWordCounts(
  masked: string,
  sentences: SentenceRange[],
): number[] {
  return sentences.map(
    (s) => tokenizeWords(masked.slice(s.start, s.end)).length,
  );
}

function checkSentenceVarianceImpl(
  content: string,
  { masked, sentences }: LintContext,
): StyleLintFinding[] {
  const findings: StyleLintFinding[] = [];
  if (sentences.length === 0) return findings;
  const counts = sentenceWordCounts(masked, sentences);

  // Any single sentence over the hard-to-read threshold.
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const count = counts[i];
    if (!s || count === undefined || count <= LONG_SENTENCE_WORDS) continue;
    findings.push({
      kind: "long-sentence",
      severity: "warn",
      message: `Long sentence — ${count} words. Consider splitting it up.`,
      excerpt: excerptForSpan(content, s.start, s.end),
      start: s.start,
      end: s.end,
    });
  }

  // Runs of 3+ consecutive sentences within ±3 words of the run's first
  // sentence — monotonous rhythm.
  let runStart = 0;
  for (let i = 1; i <= sentences.length; i++) {
    const anchor = counts[runStart] ?? 0;
    const current = counts[i];
    const withinBand =
      i < sentences.length &&
      current !== undefined &&
      Math.abs(current - anchor) <= MONOTONY_BAND;
    if (!withinBand) {
      const runLen = i - runStart;
      if (runLen >= MONOTONY_MIN_RUN) {
        const first = sentences[runStart];
        const last = sentences[i - 1];
        if (first && last) {
          findings.push({
            kind: "monotony",
            severity: "info",
            message: `${runLen} sentences in a row run about ${anchor} words each — vary sentence length for rhythm.`,
            excerpt: excerptForSpan(content, first.start, last.end),
            start: first.start,
            end: last.end,
          });
        }
      }
      runStart = i;
    }
  }

  return findings;
}

export function checkSentenceVariance(content: string): StyleLintFinding[] {
  return checkSentenceVarianceImpl(content, buildContext(content));
}

/* ────────────────────────── d. weasel words ────────────────────────── */

const WEASEL_WORDS = [
  "very",
  "really",
  "quite",
  "just",
  "perhaps",
  "arguably",
  "somewhat",
  "fairly",
  "various",
  "actually",
  "basically",
  "literally",
  "virtually",
  "practically",
  "seemingly",
  "rather",
  "a bit",
  "sort of",
  "kind of",
];

function buildPhraseRegex(phrases: string[]): RegExp {
  const escaped = [...phrases]
    .sort((a, b) => b.length - a.length)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"));
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi");
}

const WEASEL_RE = buildPhraseRegex(WEASEL_WORDS);

function checkWeaselWordsImpl(
  content: string,
  { masked, sentences }: LintContext,
): StyleLintFinding[] {
  const findings: StyleLintFinding[] = [];
  WEASEL_RE.lastIndex = 0;
  let m = WEASEL_RE.exec(masked);
  while (m !== null) {
    const start = m.index;
    const end = start + m[0].length;
    findings.push({
      kind: "weasel",
      severity: "info",
      message: `Weasel word: "${content.slice(start, end)}" — a vague qualifier; consider cutting it.`,
      excerpt: excerptForPoint(content, start, sentences),
      start,
      end,
    });
    m = WEASEL_RE.exec(masked);
  }
  return findings;
}

export function checkWeaselWords(content: string): StyleLintFinding[] {
  return checkWeaselWordsImpl(content, buildContext(content));
}

/* ────────────────────────── e. clichés ────────────────────────── */

const CLICHES = [
  "at the end of the day",
  "low-hanging fruit",
  "low hanging fruit",
  "think outside the box",
  "it goes without saying",
  "in this day and age",
  "when all is said and done",
  "the fact of the matter is",
  "last but not least",
  "needle in a haystack",
  "tip of the iceberg",
  "a blessing in disguise",
  "avoid it like the plague",
  "back to the drawing board",
  "beat around the bush",
  "better late than never",
  "bite the bullet",
  "cutting edge",
  "each and every",
  "easier said than done",
  "few and far between",
  "food for thought",
  "in the nick of time",
  "leave no stone unturned",
  "light at the end of the tunnel",
  "move the needle",
  "on the same page",
  "par for the course",
  "pushing the envelope",
  "read between the lines",
  "the bottom line",
  "the elephant in the room",
  "the whole nine yards",
  "time will tell",
  "too good to be true",
  "touch base",
  "with bated breath",
  "at this point in time",
  "in the final analysis",
  "all things considered",
  "game changer",
  "paradigm shift",
  "circle back",
  "low man on the totem pole",
];

const CLICHE_RE = buildPhraseRegex(CLICHES);

function checkClichesImpl(
  content: string,
  { masked, sentences }: LintContext,
): StyleLintFinding[] {
  const findings: StyleLintFinding[] = [];
  CLICHE_RE.lastIndex = 0;
  let m = CLICHE_RE.exec(masked);
  while (m !== null) {
    const start = m.index;
    const end = start + m[0].length;
    findings.push({
      kind: "cliche",
      severity: "warn",
      message: `Cliché: "${content.slice(start, end)}" — consider a fresher phrase.`,
      excerpt: excerptForPoint(content, start, sentences),
      start,
      end,
    });
    m = CLICHE_RE.exec(masked);
  }
  return findings;
}

export function checkCliches(content: string): StyleLintFinding[] {
  return checkClichesImpl(content, buildContext(content));
}

/* ────────────────────────── top-level entry point ────────────────────────── */

/** Run every check once over shared segmentation, sorted by document order. */
export function lintStyle(content: string): StyleLintFinding[] {
  if (!content.trim()) return [];
  const ctx = buildContext(content);
  const findings = [
    ...checkPassiveVoiceImpl(content, ctx),
    ...checkAdverbDensityImpl(content, ctx),
    ...checkSentenceVarianceImpl(content, ctx),
    ...checkWeaselWordsImpl(content, ctx),
    ...checkClichesImpl(content, ctx),
  ];
  findings.sort((a, b) => a.start - b.start);
  return findings;
}

/** Group findings by their panel row (check id) for the UI. */
export function groupFindingsByCheck(
  findings: StyleLintFinding[],
): Record<StyleLintCheckId, StyleLintFinding[]> {
  const grouped = {
    "passive-voice": [],
    "adverb-density": [],
    "sentence-variance": [],
    "weasel-words": [],
    cliches: [],
  } as Record<StyleLintCheckId, StyleLintFinding[]>;
  for (const finding of findings) {
    grouped[checkIdForKind(finding.kind)].push(finding);
  }
  return grouped;
}
