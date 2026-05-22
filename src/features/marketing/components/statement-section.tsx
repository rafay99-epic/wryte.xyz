import { WordReveal } from "@/features/marketing/components/word-reveal";

export function StatementSection() {
  return (
    <section className="py-32 sm:py-40">
      <div className="mx-auto max-w-[900px] px-6">
        <WordReveal
          segments={[
            { text: "We built Wryte because" },
            {
              text: "managing content as a developer",
              className: "text-foreground/90",
            },
            { text: "shouldn't mean juggling files and deploy scripts." },
            {
              text: "Write in a real editor, drag cards across a board,",
              className: "text-foreground/90",
            },
            { text: "and ship to GitHub with" },
            { text: "one click", underlineSvg: true },
            { text: "." },
          ]}
        />
      </div>
    </section>
  );
}
