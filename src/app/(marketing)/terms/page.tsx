"use client";

import { motion, useInView } from "framer-motion";
import { ArrowLeft, Scale } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { BrandIcon } from "@/components/branding/brand-icon";
import { MarketingThemeToggle } from "@/components/layout/marketing-theme-toggle";

/* ------------------------------------------------------------------ */
/*  Animated section wrapper — fades in when scrolled into view        */
/* ------------------------------------------------------------------ */
function Section({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Terms & Conditions                                                 */
/* ------------------------------------------------------------------ */
export default function TermsPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* ── Noise texture ──────────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] hidden opacity-[0.025] dark:block"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── Ambient glow ───────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[500px] w-[600px] -translate-x-1/2 rounded-full bg-amber-500/[0.04] blur-[120px]" />
        <div className="absolute right-1/4 top-1/2 h-[300px] w-[300px] rounded-full bg-purple-600/[0.03] blur-[100px]" />
      </div>

      <div className="relative z-10">
        {/* ── Header ─────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="fixed top-0 right-0 left-0 z-50"
        >
          <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <BrandIcon width={28} height={28} className="rounded-md" />
              <span className="text-[15px] font-semibold tracking-tight text-foreground/80">
                wryte
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <MarketingThemeToggle />
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] text-foreground/65 dark:text-foreground/35 transition-colors hover:bg-foreground/5 hover:text-foreground/70"
              >
                <ArrowLeft className="size-3.5" />
                Back to Home
              </Link>
            </div>
          </div>
        </motion.header>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="flex flex-col items-center px-6 pt-32 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl border border-foreground/[0.15] dark:border-foreground/[0.06] bg-foreground/[0.02]">
              <Scale className="size-6 text-amber-400" />
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              <span className="text-foreground/90">Terms &amp; </span>
              <span className="text-amber-400">Conditions</span>
            </h1>

            <p className="mt-4 text-[15px] text-foreground/65 dark:text-foreground/30">
              Last updated: April 9, 2026
            </p>
          </motion.div>
        </section>

        {/* ── Divider ────────────────────────────────────────────── */}
        <div className="mx-auto h-px max-w-3xl bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />

        {/* ── Content ────────────────────────────────────────────── */}
        <main className="mx-auto max-w-3xl px-6 py-16">
          <div className="space-y-10">
            <Section delay={0}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-amber-400/60">
                  01
                </span>
                Acceptance of Terms
              </h2>
              <p className="text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                By accessing or using Wryte (&ldquo;the Service&rdquo;),
                available at{" "}
                <Link
                  href="https://wryte.xyz"
                  className="text-amber-400/70 underline decoration-amber-400/20 underline-offset-4 transition-colors hover:text-amber-400"
                >
                  wryte.xyz
                </Link>
                , you agree to be bound by these Terms &amp; Conditions. If you
                do not agree, please do not use the Service.
              </p>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-amber-400/60">
                  02
                </span>
                Description of Service
              </h2>
              <p className="text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                Wryte is an editor-first content workflow tool that allows
                developers to capture ideas, refine drafts with AI assistance,
                and publish content directly to GitHub repositories. The Service
                is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo;
              </p>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-amber-400/60">
                  03
                </span>
                User Accounts
              </h2>
              <ul className="space-y-2.5 text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-400/40" />
                  <span>
                    You must authenticate via a supported provider (e.g.,
                    GitHub, Google) to access protected features.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-400/40" />
                  <span>
                    You are responsible for maintaining the security of your
                    account and any actions performed under it.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-400/40" />
                  <span>
                    You must be at least 13 years old to use the Service.
                  </span>
                </li>
              </ul>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-amber-400/60">
                  04
                </span>
                User Content
              </h2>
              <ul className="space-y-2.5 text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-purple-400/40" />
                  <span>
                    You retain full ownership of any content you create, upload,
                    or publish through the Service.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-purple-400/40" />
                  <span>
                    You grant Wryte a limited, non-exclusive license to process
                    your content solely for the purpose of providing the Service
                    (e.g., rendering previews, syncing to GitHub).
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-purple-400/40" />
                  <span>
                    You are solely responsible for the content you publish and
                    must ensure it does not violate any applicable laws or
                    third-party rights.
                  </span>
                </li>
              </ul>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-amber-400/60">
                  05
                </span>
                GitHub Integration
              </h2>
              <p className="text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                The Service connects to GitHub on your behalf using OAuth tokens
                you authorize. Wryte will only access repositories and data you
                explicitly grant access to. You may revoke this access at any
                time through your GitHub account settings.
              </p>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-amber-400/60">
                  06
                </span>
                AI Features
              </h2>
              <p className="text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                Wryte may offer AI-powered writing assistance. Content processed
                by AI features may be sent to third-party AI providers (e.g.,
                Anthropic, OpenAI). AI-generated suggestions are provided for
                convenience and should be reviewed before publishing.
              </p>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-amber-400/60">
                  07
                </span>
                Prohibited Uses
              </h2>
              <p className="mb-3 text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                You agree not to:
              </p>
              <ul className="space-y-2.5 text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-red-400/40" />
                  <span>Use the Service for any unlawful purpose.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-red-400/40" />
                  <span>
                    Attempt to gain unauthorized access to any part of the
                    Service.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-red-400/40" />
                  <span>
                    Interfere with or disrupt the integrity or performance of
                    the Service.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-red-400/40" />
                  <span>
                    Use automated scripts to collect data from or interact with
                    the Service without permission.
                  </span>
                </li>
              </ul>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-amber-400/60">
                  08
                </span>
                Limitation of Liability
              </h2>
              <p className="text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                To the maximum extent permitted by law, Wryte and its creators
                shall not be liable for any indirect, incidental, special,
                consequential, or punitive damages, including loss of data,
                profits, or goodwill, arising out of your use of the Service.
              </p>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-amber-400/60">
                  09
                </span>
                Service Availability &amp; Modifications
              </h2>
              <ul className="space-y-2.5 text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-400/40" />
                  <span>
                    We reserve the right to modify, suspend, or discontinue the
                    Service at any time without prior notice.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-400/40" />
                  <span>
                    We may update these Terms from time to time. Continued use
                    of the Service after changes constitutes acceptance of the
                    revised Terms.
                  </span>
                </li>
              </ul>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-amber-400/60">
                  10
                </span>
                Termination
              </h2>
              <p className="text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                We may terminate or suspend your access to the Service
                immediately, without prior notice, for conduct that we believe
                violates these Terms or is harmful to other users or the
                Service.
              </p>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-amber-400/60">
                  11
                </span>
                Governing Law
              </h2>
              <p className="text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                These Terms shall be governed by and construed in accordance
                with applicable laws, without regard to conflict of law
                principles.
              </p>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-amber-400/60">
                  12
                </span>
                Contact
              </h2>
              <p className="text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                If you have questions about these Terms, please reach out via
                the project&apos;s{" "}
                <Link
                  href="https://github.com/rafay99-epic/wryte.xyz"
                  className="text-amber-400/70 underline decoration-amber-400/20 underline-offset-4 transition-colors hover:text-amber-400"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub repository
                </Link>
                .
              </p>
            </Section>
          </div>
        </main>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="border-t border-foreground/[0.12] dark:border-foreground/[0.04] py-8">
          <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <BrandIcon
                width={18}
                height={18}
                className="rounded-[3px] opacity-40"
              />
              <span className="text-[12px] text-foreground/55 dark:text-foreground/20">
                &copy; {new Date().getFullYear()} Wryte
              </span>
            </div>
            <div className="flex items-center gap-5 text-[12px] text-foreground/55 dark:text-foreground/20">
              <Link
                href="/privacy"
                className="transition-colors hover:text-foreground dark:hover:text-foreground/40"
              >
                Privacy Policy
              </Link>
              <Link
                href="/"
                className="transition-colors hover:text-foreground dark:hover:text-foreground/40"
              >
                Home
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
