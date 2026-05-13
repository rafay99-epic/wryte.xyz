"use client";

import { motion, useInView } from "framer-motion";
import { ArrowLeft, Shield } from "lucide-react";
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
/*  Privacy Policy                                                     */
/* ------------------------------------------------------------------ */
export default function PrivacyPage() {
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
        <div className="absolute left-1/2 top-0 h-[500px] w-[600px] -translate-x-1/2 rounded-full bg-purple-500/[0.04] blur-[120px]" />
        <div className="absolute left-1/4 top-1/2 h-[300px] w-[300px] rounded-full bg-amber-600/[0.03] blur-[100px]" />
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
              <Shield className="size-6 text-purple-400" />
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              <span className="text-foreground/90">Privacy </span>
              <span className="text-purple-400">Policy</span>
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
                <span className="font-mono text-[13px] font-bold text-purple-400/60">
                  01
                </span>
                Introduction
              </h2>
              <p className="text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                This Privacy Policy explains how Wryte (&ldquo;we,&rdquo;
                &ldquo;us,&rdquo; or &ldquo;the Service&rdquo;) collects, uses,
                and protects your personal information when you use{" "}
                <Link
                  href="https://wryte.xyz"
                  className="text-purple-400/70 underline decoration-purple-400/20 underline-offset-4 transition-colors hover:text-purple-400"
                >
                  wryte.xyz
                </Link>
                .
              </p>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-purple-400/60">
                  02
                </span>
                Information We Collect
              </h2>
              <p className="mb-4 text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                We collect the following types of information:
              </p>
              <div className="space-y-3">
                {[
                  {
                    label: "Account Information",
                    desc: "When you sign in via a third-party provider (e.g., GitHub, Google), we receive your name, email address, and profile picture as provided by that service.",
                    color: "bg-amber-400",
                  },
                  {
                    label: "Content Data",
                    desc: "Documents, drafts, and media you create within Wryte are stored to provide the Service.",
                    color: "bg-purple-400",
                  },
                  {
                    label: "GitHub Access Tokens",
                    desc: "OAuth tokens are used to read/write to repositories you authorize. Tokens are stored securely and are never shared with third parties.",
                    color: "bg-emerald-400",
                  },
                  {
                    label: "Usage Data",
                    desc: "We may collect anonymized usage analytics (e.g., page views, feature usage) to improve the Service.",
                    color: "bg-blue-400",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-foreground/[0.15] dark:border-foreground/[0.06] bg-foreground/[0.02] px-5 py-4 transition-colors hover:border-foreground/[0.1] hover:bg-foreground/[0.03]"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <div
                        className={`size-1.5 rounded-full ${item.color}/60`}
                      />
                      <span className="text-[14px] font-medium text-foreground/70">
                        {item.label}
                      </span>
                    </div>
                    <p className="text-[14px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-purple-400/60">
                  03
                </span>
                How We Use Your Information
              </h2>
              <ul className="space-y-2.5 text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                {[
                  "To provide, maintain, and improve the Service.",
                  "To authenticate you and manage your account.",
                  "To sync your content with GitHub repositories you authorize.",
                  "To process content through AI features when you explicitly use them.",
                  "To communicate important service updates or changes.",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-purple-400/40" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-purple-400/60">
                  04
                </span>
                Third-Party Services
              </h2>
              <p className="mb-4 text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                Wryte integrates with the following third-party services:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    name: "Clerk",
                    role: "Authentication & user management",
                    href: "https://clerk.com/privacy",
                    color: "text-amber-400",
                  },
                  {
                    name: "Convex",
                    role: "Real-time database & backend",
                    href: "https://www.convex.dev/privacy",
                    color: "text-purple-400",
                  },
                  {
                    name: "GitHub",
                    role: "Repository access for publishing",
                    href: "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement",
                    color: "text-emerald-400",
                  },
                  {
                    name: "Anthropic / OpenAI",
                    role: "AI-powered writing features",
                    href: null,
                    color: "text-pink-400",
                  },
                ].map((svc) => (
                  <div
                    key={svc.name}
                    className="rounded-xl border border-foreground/[0.15] dark:border-foreground/[0.06] bg-foreground/[0.02] p-4 transition-colors hover:border-foreground/[0.1] hover:bg-foreground/[0.03]"
                  >
                    <div className={`text-[14px] font-semibold ${svc.color}`}>
                      {svc.name}
                    </div>
                    <p className="mt-1 text-[13px] text-foreground/65 dark:text-foreground/30">
                      {svc.role}
                    </p>
                    {svc.href && (
                      <Link
                        href={svc.href}
                        className="mt-2 inline-block text-[12px] text-foreground/55 underline decoration-foreground/10 underline-offset-4 transition-colors hover:text-foreground/70 dark:text-foreground/20 dark:hover:text-foreground/40"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Privacy Policy &rarr;
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-purple-400/60">
                  05
                </span>
                Data Storage &amp; Security
              </h2>
              <ul className="space-y-2.5 text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                {[
                  "Your data is stored using industry-standard cloud infrastructure with encryption at rest and in transit.",
                  "We implement reasonable security measures to protect against unauthorized access, alteration, or destruction of data.",
                  "No method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security.",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-400/40" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-purple-400/60">
                  06
                </span>
                Data Retention
              </h2>
              <p className="text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                We retain your data for as long as your account is active or as
                needed to provide the Service. You may request deletion of your
                account and associated data at any time by contacting us.
              </p>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-purple-400/60">
                  07
                </span>
                Your Rights
              </h2>
              <p className="mb-3 text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                Depending on your jurisdiction, you may have the right to:
              </p>
              <ul className="space-y-2.5 text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                {[
                  "Access the personal data we hold about you.",
                  "Request correction of inaccurate data.",
                  "Request deletion of your data.",
                  "Object to or restrict processing of your data.",
                  "Export your data in a portable format.",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-400/40" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                To exercise these rights, please contact us through the channels
                listed below.
              </p>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-purple-400/60">
                  08
                </span>
                Cookies
              </h2>
              <p className="text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                Wryte uses essential cookies required for authentication and
                session management. We do not use advertising or tracking
                cookies.
              </p>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-purple-400/60">
                  09
                </span>
                Children&apos;s Privacy
              </h2>
              <p className="text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                The Service is not directed to children under 13. We do not
                knowingly collect personal information from children under 13.
                If you believe a child has provided us with personal data,
                please contact us so we can delete it.
              </p>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-purple-400/60">
                  10
                </span>
                Changes to This Policy
              </h2>
              <p className="text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                We may update this Privacy Policy from time to time. We will
                notify users of material changes by updating the &ldquo;Last
                updated&rdquo; date above. Continued use of the Service after
                changes constitutes acceptance of the updated policy.
              </p>
            </Section>

            <Section delay={0.04}>
              <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-foreground/90">
                <span className="font-mono text-[13px] font-bold text-purple-400/60">
                  11
                </span>
                Contact
              </h2>
              <p className="text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/35">
                For privacy-related inquiries, please reach out via the
                project&apos;s{" "}
                <Link
                  href="https://github.com/rafay99-epic/wryte.xyz"
                  className="text-purple-400/70 underline decoration-purple-400/20 underline-offset-4 transition-colors hover:text-purple-400"
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
                href="/terms"
                className="transition-colors hover:text-foreground dark:hover:text-foreground/40"
              >
                Terms &amp; Conditions
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
