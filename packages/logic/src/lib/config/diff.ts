export type DiffLine = {
  kind: "context" | "add" | "remove";
  text: string;
  oldLine: number | null;
  newLine: number | null;
};

export type DiffHunk = { newStart: number; lines: DiffLine[] };

type Op = { kind: DiffLine["kind"]; text: string };

const MAX_LCS_CELLS = 4_000_000;

function splitLines(text: string): string[] {
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function middleOps(before: string[], after: string[]): Op[] {
  const removed = (lines: string[]) =>
    lines.map((text): Op => ({ kind: "remove", text }));
  const added = (lines: string[]) =>
    lines.map((text): Op => ({ kind: "add", text }));

  const rows = before.length;
  const cols = after.length;
  if (rows === 0 || cols === 0 || rows * cols > MAX_LCS_CELLS) {
    return [...removed(before), ...added(after)];
  }

  const width = cols + 1;
  const lengths = new Uint32Array((rows + 1) * width);
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      lengths[i * width + j] =
        before[i] === after[j]
          ? (lengths[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(
              lengths[(i + 1) * width + j] ?? 0,
              lengths[i * width + j + 1] ?? 0,
            );
    }
  }

  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    const left = before[i] ?? "";
    const right = after[j] ?? "";
    if (left === right) {
      ops.push({ kind: "context", text: left });
      i++;
      j++;
    } else if (
      (lengths[(i + 1) * width + j] ?? 0) >= (lengths[i * width + j + 1] ?? 0)
    ) {
      ops.push({ kind: "remove", text: left });
      i++;
    } else {
      ops.push({ kind: "add", text: right });
      j++;
    }
  }
  return [...ops, ...removed(before.slice(i)), ...added(after.slice(j))];
}

function numberLines(ops: Op[]): DiffLine[] {
  let oldLine = 0;
  let newLine = 0;
  return ops.map((op) => {
    if (op.kind !== "add") oldLine++;
    if (op.kind !== "remove") newLine++;
    return {
      kind: op.kind,
      text: op.text,
      oldLine: op.kind === "add" ? null : oldLine,
      newLine: op.kind === "remove" ? null : newLine,
    };
  });
}

export function diffLines(base: string, next: string, context = 2): DiffHunk[] {
  if (base === next) return [];
  const before = splitLines(base);
  const after = splitLines(next);
  if (
    before.length === after.length &&
    before.every((line, i) => line === after[i])
  ) {
    const line = before.length + 1;
    const endsBase = base.endsWith("\n");
    return [
      {
        newStart: line,
        lines: [
          {
            kind: endsBase ? "remove" : "add",
            text: "",
            oldLine: endsBase ? line : null,
            newLine: endsBase ? null : line,
          },
        ],
      },
    ];
  }

  let head = 0;
  const shortest = Math.min(before.length, after.length);
  while (head < shortest && before[head] === after[head]) head++;
  let tail = 0;
  while (
    tail < shortest - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail++;
  }

  const same = (lines: string[]) =>
    lines.map((text): Op => ({ kind: "context", text }));
  const lines = numberLines([
    ...same(before.slice(0, head)),
    ...middleOps(
      before.slice(head, before.length - tail),
      after.slice(head, after.length - tail),
    ),
    ...same(before.slice(before.length - tail)),
  ]);

  const hunks: DiffHunk[] = [];
  let lastKept = -1;
  let current: DiffLine[] | null = null;
  lines.forEach((line, index) => {
    if (line.kind === "context") return;
    const from = Math.max(index - context, lastKept + 1);
    if (current === null || from > lastKept + 1) {
      current = [];
      hunks.push({ newStart: 0, lines: current });
    }
    const to = Math.min(index + context, lines.length - 1);
    for (let k = from; k <= to; k++) {
      const kept = lines[k];
      if (kept && k > lastKept) current.push(kept);
    }
    lastKept = Math.max(lastKept, to);
  });

  for (const hunk of hunks) {
    const first = hunk.lines.findIndex((line) => line.kind !== "context");
    hunk.newStart = (hunk.lines[first - 1]?.newLine ?? 0) + 1;
  }
  return hunks;
}
