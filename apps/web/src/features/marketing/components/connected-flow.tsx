import { motion } from "framer-motion";
import { ArrowRight, GitMerge, RefreshCw, ShieldCheck } from "lucide-react";
import { SectionHeading } from "@/features/marketing/components/section-heading";
import { flowNodes } from "@/features/marketing/constants";

const guarantees = [
  {
    icon: GitMerge,
    title: "Diff before sync",
    desc: "Wryte compares against the file SHA in your repo and only writes what actually changed — no noisy commits.",
  },
  {
    icon: ShieldCheck,
    title: "Conflict detection",
    desc: "Edited the same file on GitHub directly? Wryte spots the drift and lets you resolve it before publishing.",
  },
  {
    icon: RefreshCw,
    title: "Durable scheduling",
    desc: "Scheduled publishes run on a workflow engine with retries — they fire even if you're offline.",
  },
];

export function ConnectedFlow() {
  return (
    <section id="how" className="relative overflow-hidden py-24 sm:py-32">
      <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />

      <div className="mx-auto max-w-[1100px] px-6">
        <SectionHeading
          eyebrow="How it fits together"
          eyebrowClassName="text-blue-400/70"
          title="One workspace, one source of truth"
          description="The editor, the board, and the scheduler all feed a single publish engine. It writes plain markdown straight into your repo — so GitHub, not Wryte, owns your content."
          align="center"
          className="mb-16"
        />

        {/* Pipeline */}
        <div className="relative">
          {/* Connecting gradient line (desktop) */}
          <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-amber-400/40 via-blue-400/40 to-emerald-400/50 lg:block" />

          <div className="grid gap-8 lg:grid-cols-4 lg:gap-5">
            {flowNodes.map((node, i) => (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.12 }}
                className="relative text-center lg:text-left"
              >
                <div className="relative mb-5 flex justify-center lg:justify-start">
                  <div className="relative flex size-14 items-center justify-center">
                    <div
                      className={`absolute inset-0 scale-[2] rounded-full ${node.glow} blur-xl`}
                    />
                    <div className="relative z-10 flex size-14 items-center justify-center rounded-2xl border border-foreground/[0.1] bg-background/80 backdrop-blur-sm dark:border-foreground/[0.07] dark:bg-foreground/[0.03]">
                      <span className={`size-3 rounded-full ${node.dot}`} />
                    </div>
                  </div>

                  {/* Inline arrow between nodes on desktop */}
                  {i < flowNodes.length - 1 ? (
                    <ArrowRight className="absolute -right-3 top-4 hidden size-4 text-foreground/20 lg:block" />
                  ) : null}
                </div>

                <p
                  className={`mb-1 font-mono text-[11px] uppercase tracking-wider ${node.color}`}
                >
                  0{i + 1}
                </p>
                <h3 className="text-[15px] font-semibold text-foreground/85">
                  {node.label}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/55 dark:text-foreground/35">
                  {node.sub}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Source-of-truth callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto mt-14 max-w-2xl rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] px-6 py-5 text-center"
        >
          <p className="text-[14px] leading-relaxed text-foreground/65 dark:text-foreground/45">
            Wryte never becomes a place your content gets trapped. It&apos;s a{" "}
            <span className="font-semibold text-emerald-400/90">
              writing and publishing layer on top of your repo
            </span>
            . Delete your account tomorrow and every word still lives in GitHub
            as version-controlled markdown.
          </p>
        </motion.div>

        {/* Guarantees */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {guarantees.map((g, i) => {
            const Icon = g.icon;
            return (
              <motion.div
                key={g.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.02] p-5 dark:border-foreground/[0.05]"
              >
                <Icon className="mb-3 size-4 text-foreground/50" />
                <h4 className="text-[13px] font-semibold text-foreground/80">
                  {g.title}
                </h4>
                <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/55 dark:text-foreground/35">
                  {g.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
