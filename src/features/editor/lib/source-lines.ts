/**
 * Source-position plumbing between markdown source and the rendered preview.
 *
 * `remarkSourceLines` stamps each block's 1-indexed source line onto its
 * rendered element as `data-source-line`; `resolveDoubleClickOffset` walks
 * back from a double-clicked preview element to a character offset in the
 * source, so the editor can drop the caret exactly where the reader clicked.
 */

type MdastNode = {
  type: string;
  position?: { start?: { line?: number } };
  data?: { hProperties?: Record<string, unknown> };
  children?: MdastNode[];
};

/** Remark plugin: stamp `data-source-line` on every positioned node. */
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

/** 1-indexed line containing character `index`. Inverse of lineStartOffset. */
export function lineOfIndex(content: string, index: number): number {
  let line = 1;
  const end = Math.min(index, content.length);
  for (let i = 0; i < end; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

/** Character offset of the start of a 1-indexed line. */
export function lineStartOffset(content: string, line: number): number {
  let offset = 0;
  for (let i = 1; i < line; i++) {
    const next = content.indexOf("\n", offset);
    if (next === -1) return offset;
    offset = next + 1;
  }
  return offset;
}

/**
 * Maps a double-clicked preview element to a caret offset in the markdown
 * source. Uses the stamped `data-source-line` when present, refined to the
 * double-clicked word (the browser selects it before dblclick fires). When
 * no line is stamped — MDX previews compile away position info — falls back
 * to a whole-document word search.
 */
export function resolveDoubleClickOffset(
  target: HTMLElement,
  content: string,
): number | null {
  const stamped = target.closest<HTMLElement>("[data-source-line]");
  const word = window.getSelection()?.toString().trim() || null;

  if (stamped) {
    const line = Number(stamped.dataset["sourceLine"]);
    const start = lineStartOffset(content, line);
    if (word) {
      // ponytail: word search bounded to 2000 chars past the block start —
      // enough for any block, avoids matching the same word in a later section.
      const idx = content.indexOf(word, start);
      if (idx !== -1 && idx - start < 2000) return idx;
    }
    return start;
  }

  if (word && word.length >= 3) {
    // ponytail: first-occurrence global search — only path for MDX, where the
    // rendered output carries no source positions.
    const idx = content.indexOf(word);
    if (idx !== -1) return idx;
  }
  return null;
}
