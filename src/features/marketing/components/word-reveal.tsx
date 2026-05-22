import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export type WordSegment = {
  text: string;
  className?: string;
  underlineSvg?: boolean;
};

export function WordReveal({ segments }: { segments: WordSegment[] }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  let wordIndex = 0;
  const nodes: React.ReactNode[] = [];

  for (const segment of segments) {
    const words = segment.text.split(/(\s+)/);
    for (const word of words) {
      if (/^\s+$/.test(word)) {
        nodes.push(<span key={`sp-${wordIndex}`}>{word}</span>);
        continue;
      }
      const i = wordIndex++;
      const node = (
        <motion.span
          key={`w-${i}`}
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{
            duration: 0.4,
            delay: i * 0.04,
            ease: [0.22, 1, 0.36, 1],
          }}
          className={`inline-block ${segment.className ?? ""}`}
        >
          {segment.underlineSvg ? (
            <span className="relative inline-block text-amber-400">
              {word}
              <svg
                className="absolute -bottom-1 left-0 w-full"
                viewBox="0 0 100 6"
                preserveAspectRatio="none"
              >
                <motion.path
                  d="M0,5 Q25,0 50,4 T100,3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  initial={{ pathLength: 0 }}
                  animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
                  transition={{
                    duration: 0.8,
                    delay: i * 0.04 + 0.3,
                    ease: "easeOut",
                  }}
                />
              </svg>
            </span>
          ) : (
            word
          )}
        </motion.span>
      );
      nodes.push(node);
      nodes.push(<span key={`gap-${i}`}> </span>);
    }
  }

  return (
    <p
      ref={ref}
      className="text-center text-[clamp(1.25rem,3vw,2rem)] font-light leading-[1.5] tracking-[-0.01em] text-foreground/75 dark:text-foreground/50"
    >
      {nodes}
    </p>
  );
}
