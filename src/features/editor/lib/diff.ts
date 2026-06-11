/**
 * Line-based diff for the snapshot history view. Common prefix/suffix are
 * trimmed first, then the middle is aligned with an LCS table. Documents
 * here are blog posts (hundreds of lines), so the DP stays tiny; a guard
 * degrades gracefully to a remove-all/add-all block if two versions
 * somehow diverge across thousands of lines.
 */

export type DiffLine = {
  type: "same" | "added" | "removed";
  text: string;
};

const MAX_LCS_CELLS = 250_000;

export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    start++;
  }
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const middleA = a.slice(start, endA);
  const middleB = b.slice(start, endB);
  const middle =
    middleA.length * middleB.length > MAX_LCS_CELLS
      ? [
          ...middleA.map((text) => ({ type: "removed" as const, text })),
          ...middleB.map((text) => ({ type: "added" as const, text })),
        ]
      : lcsDiff(middleA, middleB);

  return [
    ...a.slice(0, start).map((text) => ({ type: "same" as const, text })),
    ...middle,
    ...a.slice(endA).map((text) => ({ type: "same" as const, text })),
  ];
}

function lcsDiff(a: string[], b: string[]): DiffLine[] {
  const rows = a.length + 1;
  const cols = b.length + 1;
  // Flat Int32 table: lengths[i][j] = LCS length of a[i:], b[j:].
  const lengths = new Int32Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i * cols + j] =
        a[i] === b[j]
          ? (lengths[(i + 1) * cols + j + 1] as number) + 1
          : Math.max(
              lengths[(i + 1) * cols + j] as number,
              lengths[i * cols + j + 1] as number,
            );
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] as string });
      i++;
      j++;
    } else if (
      (lengths[(i + 1) * cols + j] as number) >=
      (lengths[i * cols + j + 1] as number)
    ) {
      out.push({ type: "removed", text: a[i] as string });
      i++;
    } else {
      out.push({ type: "added", text: b[j] as string });
      j++;
    }
  }
  while (i < a.length) {
    out.push({ type: "removed", text: a[i] as string });
    i++;
  }
  while (j < b.length) {
    out.push({ type: "added", text: b[j] as string });
    j++;
  }
  return out;
}

export type DiffStats = { added: number; removed: number };

export function diffStats(lines: DiffLine[]): DiffStats {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.type === "added") added++;
    else if (line.type === "removed") removed++;
  }
  return { added, removed };
}
