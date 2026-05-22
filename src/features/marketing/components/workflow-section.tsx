import { motion } from "framer-motion";

export function WorkflowSection() {
  return (
    <section id="workflow" className="relative overflow-hidden py-24 sm:py-32">
      <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />

      <div className="mx-auto max-w-[1100px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <p className="text-[13px] font-medium tracking-[0.15em] text-amber-400/60 uppercase">
            Workflow
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Idea to published in three moves
          </h2>
        </motion.div>

        <div className="relative">
          <div className="absolute left-0 right-0 top-12 hidden h-px bg-gradient-to-r from-amber-400/30 via-purple-400/30 to-emerald-400/30 lg:block" />

          <div className="grid gap-8 lg:grid-cols-3 lg:gap-4">
            {[
              {
                num: "01",
                title: "Capture",
                desc: "Open the editor. Start typing markdown. Auto-save catches every keystroke. Frontmatter fields build themselves from your schema.",
                color: "text-amber-400",
                dotColor: "bg-amber-400",
                glowColor: "bg-amber-400/20",
              },
              {
                num: "02",
                title: "Organize",
                desc: "Drag cards across your kanban board. Tag, rename, and preview inline. Use keyboard shortcuts to move fast without touching the mouse.",
                color: "text-purple-400",
                dotColor: "bg-purple-400",
                glowColor: "bg-purple-400/20",
              },
              {
                num: "03",
                title: "Ship",
                desc: "Hit publish or schedule for later. Wryte commits to your GitHub repo, and your content is live. Bulk-publish when you're ready to ship a batch.",
                color: "text-emerald-400",
                dotColor: "bg-emerald-400",
                glowColor: "bg-emerald-400/20",
              },
            ].map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                className="relative text-center lg:text-left"
              >
                <div className="mx-auto mb-6 flex size-24 items-center justify-center lg:mx-0">
                  <div className="relative">
                    <div
                      className={`absolute inset-0 scale-[3] rounded-full ${step.glowColor} blur-xl`}
                    />
                    <div
                      className={`relative z-10 size-6 rounded-full ${step.dotColor}`}
                    />
                  </div>
                </div>

                <div
                  className={`mb-2 font-mono text-[13px] font-bold ${step.color}`}
                >
                  {step.num}
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground/90">
                  {step.title}
                </h3>
                <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30 lg:mx-0">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
