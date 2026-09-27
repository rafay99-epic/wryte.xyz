export type OutlineHeading = {
  level: number;
  text: string;
  start: number;
  end: number;
};

const HEADING_RE = /^(#{1,6})\s+(.*\S)/;
const FENCE_RE = /^(```|~~~)/;

export function parseOutline(content: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  let inFence = false;
  let offset = 0;

  for (const line of content.split("\n")) {
    if (FENCE_RE.test(line.trimStart())) {
      inFence = !inFence;
    } else if (!inFence) {
      const match = HEADING_RE.exec(line);
      if (match) {
        headings.push({
          level: (match[1] as string).length,
          text: (match[2] as string).replace(/\s+#+\s*$/, ""),
          start: offset,
          end: offset + line.length,
        });
      }
    }
    offset += line.length + 1;
  }
  return headings;
}
