export type FuzzyMatch = {
  score: number;
  positions: number[];
};

const isWordStart = (target: string, i: number): boolean =>
  i === 0 || /[\s\-_/.:(["']/.test(target.charAt(i - 1));

export function fuzzyMatch(token: string, target: string): FuzzyMatch | null {
  if (!token) return null;
  const t = target.toLowerCase();

  const idx = t.indexOf(token);
  if (idx !== -1) {
    let score = 100;
    if (idx === 0) score += 40;
    else if (isWordStart(t, idx)) score += 25;
    score += Math.max(0, 20 - Math.floor(t.length / 4));
    const positions: number[] = [];
    for (let i = idx; i < idx + token.length; i++) positions.push(i);
    return { score, positions };
  }

  const positions: number[] = [];
  let score = 0;
  let ti = 0;
  let prev = -2;
  for (const ch of token) {
    let found = -1;
    for (let i = ti; i < t.length; i++) {
      if (t.charAt(i) === ch) {
        found = i;
        break;
      }
    }
    if (found === -1) return null;
    if (found === prev + 1) score += 8;
    else if (isWordStart(t, found)) score += 10;
    else score += 1;
    positions.push(found);
    prev = found;
    ti = found + 1;
  }
  const spread = (positions[positions.length - 1] ?? 0) - (positions[0] ?? 0);
  return {
    score: Math.min(90, score) - Math.min(20, Math.floor(spread / 8)),
    positions,
  };
}

export type ScoredItem = {
  score: number;
  labelPositions: number[];
};

const KEYWORD_WEIGHT = 0.7;

export function scoreItem(
  query: string,
  label: string,
  keywords?: string,
): ScoredItem | null {
  const tokens = query.trim().toLowerCase().split(/\s+/);
  if (tokens.length === 0) return null;

  let total = 0;
  const labelPositions = new Set<number>();

  for (const token of tokens) {
    const onLabel = fuzzyMatch(token, label);
    const onKeywords = keywords ? fuzzyMatch(token, keywords) : null;
    const labelScore = onLabel?.score ?? 0;
    const keywordScore = (onKeywords?.score ?? 0) * KEYWORD_WEIGHT;
    if (labelScore <= 0 && keywordScore <= 0) return null;
    total += Math.max(labelScore, keywordScore);
    if (onLabel && labelScore >= keywordScore) {
      for (const p of onLabel.positions) labelPositions.add(p);
    }
  }

  return {
    score: total,
    labelPositions: [...labelPositions].sort((a, b) => a - b),
  };
}
