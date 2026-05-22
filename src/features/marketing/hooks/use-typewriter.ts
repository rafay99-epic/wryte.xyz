import { useEffect, useState } from "react";

export function useTypewriter(
  lines: string[],
  speed = 40,
  lineDelay = 600,
  startDelay = 0,
  active = true,
) {
  const [output, setOutput] = useState<string[]>([]);
  const [cursorLine, setCursorLine] = useState(0);
  const [cursorChar, setCursorChar] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setStarted(true), startDelay);
    return () => clearTimeout(t);
  }, [startDelay, active]);

  useEffect(() => {
    if (!started || cursorLine >= lines.length) return;

    const currentLine = lines[cursorLine] ?? "";

    if (cursorChar < currentLine.length) {
      const t = setTimeout(() => {
        setOutput((prev) => {
          const next = [...prev];
          next[cursorLine] = currentLine.slice(0, cursorChar + 1);
          return next;
        });
        setCursorChar((c) => c + 1);
      }, speed);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      setCursorLine((l) => l + 1);
      setCursorChar(0);
      setOutput((prev) => [...prev, ""]);
    }, lineDelay);
    return () => clearTimeout(t);
  }, [started, cursorLine, cursorChar, lines, speed, lineDelay]);

  return { output, cursorLine, cursorChar, isDone: cursorLine >= lines.length };
}
