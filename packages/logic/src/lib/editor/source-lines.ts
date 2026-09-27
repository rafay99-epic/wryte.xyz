type MdastNode = {
  type: string;
  position?: { start?: { line?: number } };
  data?: { hProperties?: Record<string, unknown> };
  children?: MdastNode[];
};

export function remarkSourceLines() {
  return (tree: MdastNode) => {
    const visit = (node: MdastNode) => {
      const line = node.position?.start?.line;
      if (line !== undefined && node.type !== "root") {
        node.data ??= {};
        node.data.hProperties ??= {};
        node.data.hProperties["data-source-line"] = String(line);
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  };
}

export function lineOfIndex(content: string, index: number): number {
  let line = 1;
  const end = Math.min(index, content.length);
  for (let i = 0; i < end; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

export function lineStartOffset(content: string, line: number): number {
  let offset = 0;
  for (let i = 1; i < line; i++) {
    const next = content.indexOf("\n", offset);
    if (next === -1) return offset;
    offset = next + 1;
  }
  return offset;
}

export function resolveDoubleClickOffset(
  target: HTMLElement,
  content: string,
): number | null {
  const stamped = target.closest<HTMLElement>("[data-source-line]");
  const word = window.getSelection()?.toString().trim() || null;

  const line = stamped ? Number(stamped.dataset["sourceLine"]) : Number.NaN;
  if (stamped && Number.isInteger(line) && line >= 1) {
    const start = lineStartOffset(content, line);
    if (word) {
      const idx = content.indexOf(word, start);
      if (idx !== -1 && idx - start < 2000) return idx;
    }
    return start;
  }

  if (word && word.length >= 3) {
    const idx = content.indexOf(word);
    if (idx !== -1) return idx;
  }
  return null;
}
