"use client";

import { useUser } from "@clerk/nextjs";
import {
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  Command,
  Eye,
  GitBranch,
  Keyboard,
  Layers,
  Save,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Typewriter hook — types out content character by character          */
/* ------------------------------------------------------------------ */

function useTypewriter(
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

    // Move to next line
    const t = setTimeout(() => {
      setCursorLine((l) => l + 1);
      setCursorChar(0);
      setOutput((prev) => [...prev, ""]);
    }, lineDelay);
    return () => clearTimeout(t);
  }, [started, cursorLine, cursorChar, lines, speed, lineDelay]);

  return { output, cursorLine, cursorChar, isDone: cursorLine >= lines.length };
}

/* ------------------------------------------------------------------ */
/*  Magnetic button — follows cursor subtly                            */
/* ------------------------------------------------------------------ */

function MagneticButton({
  children,
  href,
  className,
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20 });
  const springY = useSpring(y, { stiffness: 300, damping: 20 });

  const handleMouse = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      x.set((e.clientX - centerX) * 0.15);
      y.set((e.clientY - centerY) * 0.15);
    },
    [x, y],
  );

  const handleLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.a
      ref={ref}
      href={href}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      className={className}
    >
      {children}
    </motion.a>
  );
}

/* ------------------------------------------------------------------ */
/*  Marquee — infinite horizontal scroll                               */
/* ------------------------------------------------------------------ */

function Marquee({
  items,
  reverse = false,
}: {
  items: string[];
  reverse?: boolean;
}) {
  return (
    <div className="relative flex overflow-hidden select-none">
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-linear-to-r from-[#08080D] to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-linear-to-l from-[#08080D] to-transparent" />
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="flex shrink-0 items-center gap-8 px-4"
          animate={{ x: reverse ? ["0%", "-100%"] : ["-100%", "0%"] }}
          transition={{
            x: {
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "loop",
              duration: 30,
              ease: "linear",
            },
          }}
        >
          {items.map((item) => (
            <span
              key={`${i}-${item}`}
              className="whitespace-nowrap text-sm font-medium tracking-[0.2em] text-white/10 uppercase"
            >
              {item}
            </span>
          ))}
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Orbital ring around logo                                           */
/* ------------------------------------------------------------------ */

function OrbitalRing({
  size,
  duration,
  opacity,
  delay = 0,
}: {
  size: number;
  duration: number;
  opacity: number;
  delay?: number;
}) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 rounded-full border border-amber-400"
      style={{
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        opacity,
      }}
      animate={{ rotate: 360 }}
      transition={{
        duration,
        repeat: Number.POSITIVE_INFINITY,
        ease: "linear",
        delay,
      }}
    >
      <div
        className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-amber-400"
        style={{ opacity: opacity * 3 }}
      />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bento card wrapper                                                 */
/* ------------------------------------------------------------------ */

function BentoCard({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={
        isInView
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 30, scale: 0.97 }
      }
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-colors duration-500 hover:border-white/[0.12] hover:bg-white/[0.04] ${className ?? ""}`}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Editor line component for the live demo                            */
/* ------------------------------------------------------------------ */

const editorLines = [
  "---",
  'title: "Shipping Faster with Wryte"',
  "date: 2026-04-07",
  "tags: [devtools, workflow]",
  "draft: false",
  "---",
  "",
  "# The Developer Content Problem",
  "",
  "Most developers write in markdown but",
  "publishing still means committing,",
  "pushing, and waiting for deploys.",
  "",
  "**Wryte changes that.** One click from",
  "editor to your GitHub-powered site.",
];

/* ------------------------------------------------------------------ */
/*  Main landing page                                                  */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const { isSignedIn, user } = useUser();
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInView = useInView(editorRef, { once: true, margin: "-150px" });

  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroOpacity = useTransform(heroProgress, [0, 0.8], [1, 0]);
  const heroBlur = useTransform(heroProgress, [0, 0.8], [0, 10]);
  const logoScale = useTransform(heroProgress, [0, 0.5], [1, 1.2]);

  const { output, cursorLine } = useTypewriter(
    editorLines,
    35,
    400,
    800,
    editorInView,
  );

  // Smooth scroll handler
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen bg-[#08080D] text-white"
    >
      {/* ── Subtle noise texture ─────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10">
        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  HEADER                                                       */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="fixed top-0 right-0 left-0 z-50"
        >
          <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/wryte-icon.png"
                alt="Wryte"
                width={28}
                height={28}
                className="rounded-md"
                style={{ width: 28, height: "auto" }}
              />
              <span className="text-[15px] font-semibold tracking-tight text-white/80">
                wryte
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {["Features", "Editor", "Workflow"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => scrollToSection(item.toLowerCase())}
                  className="rounded-lg px-3.5 py-1.5 text-[13px] text-white/35 transition-colors hover:bg-white/5 hover:text-white/70"
                >
                  {item}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              {isSignedIn ? (
                <>
                  <Link
                    href="/dashboard"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-500 px-4 text-[13px] font-medium text-black transition-all hover:bg-amber-400"
                  >
                    Dashboard
                    <ArrowRight className="size-3.5" />
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/5"
                  >
                    {user?.imageUrl ? (
                      <Image
                        src={user.imageUrl}
                        alt={user.fullName ?? ""}
                        width={28}
                        height={28}
                        className="rounded-full"
                        style={{ width: 28, height: "auto" }}
                      />
                    ) : (
                      <div className="flex size-7 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-semibold text-amber-400">
                        {user?.firstName?.[0] ?? "U"}
                      </div>
                    )}
                    <span className="hidden text-[13px] font-medium text-white/70 sm:block">
                      {user?.firstName}
                    </span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    className="hidden rounded-lg px-3.5 py-1.5 text-[13px] text-white/40 transition-colors hover:text-white/80 sm:block"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/sign-up"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-500 px-4 text-[13px] font-medium text-black transition-all hover:bg-amber-400"
                  >
                    Get Started
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </motion.header>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  HERO — Cinematic logo reveal + bold statement                */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section
          ref={heroRef}
          className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6"
        >
          {/* Ambient gradients */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.07] blur-[100px]" />
            <div className="absolute right-1/4 top-2/3 h-[400px] w-[400px] rounded-full bg-purple-600/[0.04] blur-[100px]" />
          </div>

          <motion.div
            style={{
              opacity: heroOpacity,
              filter: useTransform(heroBlur, (v) => `blur(${v}px)`),
            }}
            className="relative flex flex-col items-center"
          >
            {/* Logo with orbital rings */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative mb-16"
            >
              <motion.div style={{ scale: logoScale }}>
                <div className="relative">
                  <OrbitalRing size={200} duration={20} opacity={0.06} />
                  <OrbitalRing
                    size={280}
                    duration={35}
                    opacity={0.03}
                    delay={2}
                  />
                  <OrbitalRing
                    size={360}
                    duration={50}
                    opacity={0.02}
                    delay={5}
                  />

                  <Image
                    src="/wryte-icon.png"
                    alt="Wryte"
                    width={100}
                    height={100}
                    className="relative z-10"
                    style={{ width: 100, height: "auto" }}
                    priority
                  />

                  {/* Logo glow */}
                  <div className="absolute inset-0 z-0 scale-[2] rounded-full bg-amber-500/20 blur-3xl" />
                </div>
              </motion.div>
            </motion.div>

            {/* Headline — bold, clean, no gradient cliches */}
            <div className="relative text-center">
              <motion.h1
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.4,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="text-[clamp(2.5rem,7vw,5.5rem)] font-bold leading-[0.95] tracking-[-0.03em]"
              >
                <span className="block text-white/90">Write.</span>
                <span className="block text-white/90">Refine.</span>
                <span className="relative block">
                  <span className="text-amber-400">Publish.</span>
                  {/* Animated underline */}
                  <motion.span
                    className="absolute -bottom-2 left-0 h-[3px] rounded-full bg-gradient-to-r from-amber-400 to-purple-500"
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{
                      duration: 0.8,
                      delay: 1.4,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.9 }}
                className="mx-auto mt-8 max-w-md text-[17px] leading-relaxed text-white/30"
              >
                A markdown editor that publishes to GitHub.
                <br />
                Built for developers who ship content.
              </motion.p>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.2 }}
                className="mt-10 flex items-center justify-center gap-4"
              >
                <MagneticButton
                  href={isSignedIn ? "/dashboard" : "/sign-up"}
                  className="group relative inline-flex h-12 items-center gap-2 rounded-xl bg-amber-500 px-7 text-[15px] font-semibold text-black transition-all hover:bg-amber-400"
                >
                  {isSignedIn ? "Go to Dashboard" : "Start Writing"}
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </MagneticButton>

                <MagneticButton
                  href="#editor"
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/[0.08] px-7 text-[15px] font-medium text-white/50 transition-all hover:border-white/20 hover:text-white/80"
                >
                  See it in action
                </MagneticButton>
              </motion.div>
            </div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 1 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
              className="flex flex-col items-center gap-2"
            >
              <span className="text-[10px] font-medium tracking-[0.3em] text-white/15 uppercase">
                Scroll
              </span>
              <div className="h-8 w-px bg-gradient-to-b from-white/20 to-transparent" />
            </motion.div>
          </motion.div>
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  MARQUEE — Visual rhythm breaker                              */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <div className="border-y border-white/[0.04] py-5">
          <Marquee
            items={[
              "Markdown",
              "GitHub Publishing",
              "Live Preview",
              "Frontmatter",
              "Auto-Save",
              "Scheduling",
              "Split View",
              "Keyboard Shortcuts",
              "Dark Mode",
              "Real-time Sync",
            ]}
          />
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  STATEMENT — A single powerful line                           */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section className="py-32 sm:py-40">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1 }}
            className="mx-auto max-w-[900px] px-6"
          >
            <p className="text-center text-[clamp(1.25rem,3vw,2rem)] font-light leading-[1.5] tracking-[-0.01em] text-white/50">
              We built Wryte because{" "}
              <span className="text-white/90">
                publishing content as a developer
              </span>{" "}
              shouldn&apos;t require a deploy pipeline.{" "}
              <span className="text-white/90">
                Write in markdown, preview live,{" "}
              </span>
              and push to GitHub with{" "}
              <span className="relative inline-block text-amber-400">
                one click
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
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
                  />
                </svg>
              </span>
              .
            </p>
          </motion.div>
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  LIVE EDITOR — The centerpiece. Show, don't tell.             */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section id="editor" className="relative py-24 sm:py-32">
          <div className="mx-auto max-w-[1100px] px-6">
            {/* Section intro */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
              className="mb-12"
            >
              <p className="text-[13px] font-medium tracking-[0.15em] text-amber-400/60 uppercase">
                The Editor
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Where your words come alive
              </h2>
            </motion.div>

            {/* Editor frame */}
            <motion.div
              ref={editorRef}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              {/* Glow behind editor */}
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-amber-500/20 via-transparent to-purple-500/10 blur-sm" />

              <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0C0C13] shadow-2xl shadow-black/60">
                {/* ── Title bar ────────────────────────────────── */}
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="size-[10px] rounded-full bg-[#ff5f57]" />
                      <div className="size-[10px] rounded-full bg-[#febc2e]" />
                      <div className="size-[10px] rounded-full bg-[#28c840]" />
                    </div>
                    <div className="ml-3 flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2.5 py-1">
                      <Layers className="size-3 text-white/20" />
                      <span className="text-[11px] text-white/25">my-blog</span>
                      <span className="text-[11px] text-white/10">/</span>
                      <span className="text-[11px] text-white/40">
                        shipping-faster.md
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {["Edit", "Split", "Preview"].map((mode, i) => (
                      <div
                        key={mode}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          i === 0
                            ? "bg-amber-500/15 text-amber-400"
                            : "text-white/20 hover:text-white/40"
                        }`}
                      >
                        {mode}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Editor + sidebar layout ─────────────────── */}
                <div className="flex">
                  {/* Frontmatter sidebar */}
                  <div className="hidden w-56 shrink-0 border-r border-white/[0.04] p-4 lg:block">
                    <div className="mb-3 text-[10px] font-semibold tracking-[0.15em] text-white/20 uppercase">
                      Frontmatter
                    </div>
                    {[
                      { label: "Title", value: "Shipping Faster..." },
                      { label: "Date", value: "2026-04-07" },
                      { label: "Tags", value: "devtools, workflow" },
                      { label: "Draft", value: "false" },
                    ].map((field) => (
                      <div key={field.label} className="mb-3">
                        <div className="text-[10px] font-medium text-white/25">
                          {field.label}
                        </div>
                        <div className="mt-0.5 rounded bg-white/[0.03] px-2 py-1 text-[11px] text-white/40">
                          {field.value}
                        </div>
                      </div>
                    ))}

                    <div className="mt-6 border-t border-white/[0.04] pt-4">
                      <div className="mb-2 text-[10px] font-semibold tracking-[0.15em] text-white/20 uppercase">
                        Status
                      </div>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
                        <div className="size-1.5 rounded-full bg-emerald-400" />
                        Ready to publish
                      </div>
                    </div>
                  </div>

                  {/* Main editor area */}
                  <div className="min-h-[380px] flex-1 p-5 sm:p-6">
                    <div className="font-mono text-[13px] leading-[1.8] sm:text-sm">
                      {output.map((line, i) => (
                        <div key={i} className="flex">
                          {/* Line number */}
                          <span className="mr-4 inline-block w-5 shrink-0 text-right text-white/10 select-none">
                            {i + 1}
                          </span>
                          <span>
                            {/* Color the lines based on content */}
                            {line.startsWith("---") ? (
                              <span className="text-white/15">{line}</span>
                            ) : line.startsWith("#") ? (
                              <span className="font-semibold text-white/80">
                                {line}
                              </span>
                            ) : line.includes(":") && i < 6 ? (
                              <>
                                <span className="text-purple-400">
                                  {line.split(":")[0]}
                                </span>
                                <span className="text-white/20">:</span>
                                <span className="text-amber-300/70">
                                  {line.slice(line.indexOf(":") + 1)}
                                </span>
                              </>
                            ) : line.includes("**") ? (
                              <span className="text-white/40">
                                {line.split("**").map((part, j) =>
                                  j % 2 === 1 ? (
                                    <span
                                      key={j}
                                      className="font-semibold text-white/80"
                                    >
                                      {part}
                                    </span>
                                  ) : (
                                    <span key={j}>{part}</span>
                                  ),
                                )}
                              </span>
                            ) : (
                              <span className="text-white/35">{line}</span>
                            )}
                            {/* Blinking cursor at current position */}
                            {i === cursorLine && (
                              <motion.span
                                animate={{ opacity: [1, 0] }}
                                transition={{
                                  duration: 0.8,
                                  repeat: Number.POSITIVE_INFINITY,
                                  repeatType: "reverse",
                                }}
                                className="ml-px inline-block h-[1.1em] w-[2px] translate-y-[2px] bg-amber-400"
                              />
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Status bar ──────────────────────────────── */}
                <div className="flex items-center justify-between border-t border-white/[0.04] px-4 py-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-white/15">Markdown</span>
                    <span className="text-[10px] text-white/15">UTF-8</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400/50">
                    <Save className="size-3" />
                    Saved
                  </div>
                </div>
              </div>

              {/* ── Floating annotation cards ────────────────── */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.5, duration: 0.6 }}
                className="absolute -right-3 top-1/4 hidden xl:block"
              >
                <div className="rounded-xl border border-white/[0.06] bg-[#0C0C13]/90 p-3 shadow-xl backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Eye className="size-3.5 text-purple-400" />
                    <span className="text-[11px] font-medium text-white/50">
                      Live Preview
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-white/25">
                    Toggle split view to see
                    <br />
                    rendered output instantly
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.8, duration: 0.6 }}
                className="absolute -left-3 bottom-1/3 hidden xl:block"
              >
                <div className="rounded-xl border border-white/[0.06] bg-[#0C0C13]/90 p-3 shadow-xl backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Keyboard className="size-3.5 text-amber-400" />
                    <span className="text-[11px] font-medium text-white/50">
                      Keyboard First
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-white/25">
                    Ctrl+B, Ctrl+I, Ctrl+K
                    <br />
                    and more — stays native
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  BENTO GRID — Asymmetric, each cell is unique                 */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section id="features" className="py-24 sm:py-32">
          <div className="mx-auto max-w-[1100px] px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
              className="mb-12"
            >
              <p className="text-[13px] font-medium tracking-[0.15em] text-purple-400/60 uppercase">
                Capabilities
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Designed for how developers actually work
              </h2>
            </motion.div>

            {/* Bento layout — asymmetric grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[260px_260px]">
              {/* ── Card 1: GitHub Publishing (large, spans 2 rows) ── */}
              <BentoCard className="lg:row-span-2" delay={0}>
                <div className="flex h-full flex-col p-6">
                  <GitBranch className="mb-4 size-5 text-amber-400" />
                  <h3 className="mb-2 text-lg font-semibold text-white/90">
                    GitHub Native
                  </h3>
                  <p className="mb-6 text-[13px] leading-relaxed text-white/30">
                    Connect any repo, configure content paths, and publish.
                    Wryte generates clean commits and tracks file SHAs for smart
                    create-or-update logic.
                  </p>

                  {/* Mini commit log visualization */}
                  <div className="mt-auto space-y-2.5">
                    {[
                      {
                        msg: "feat: add getting-started guide",
                        time: "2m ago",
                        color: "bg-emerald-400",
                      },
                      {
                        msg: "content: update api-reference",
                        time: "1h ago",
                        color: "bg-amber-400",
                      },
                      {
                        msg: "feat: new blog post — shipping",
                        time: "3h ago",
                        color: "bg-purple-400",
                      },
                      {
                        msg: "fix: frontmatter date format",
                        time: "1d ago",
                        color: "bg-blue-400",
                      },
                    ].map((commit) => (
                      <div
                        key={commit.msg}
                        className="flex items-start gap-3 rounded-lg bg-white/[0.02] px-3 py-2 transition-colors group-hover:bg-white/[0.04]"
                      >
                        <div
                          className={`mt-1.5 size-1.5 shrink-0 rounded-full ${commit.color}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-[11px] text-white/40">
                            {commit.msg}
                          </div>
                          <div className="text-[10px] text-white/15">
                            {commit.time}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </BentoCard>

              {/* ── Card 2: Smart Scheduling ────────────────────── */}
              <BentoCard delay={0.08}>
                <div className="flex h-full flex-col p-6">
                  <Clock className="mb-4 size-5 text-purple-400" />
                  <h3 className="mb-2 text-lg font-semibold text-white/90">
                    Schedule & Forget
                  </h3>
                  <p className="text-[13px] leading-relaxed text-white/30">
                    Pick a date and time. Wryte&apos;s cron engine handles the
                    rest — your content goes live while you sleep.
                  </p>

                  {/* Mini calendar visualization */}
                  <div className="mt-auto grid grid-cols-7 gap-1">
                    {Array.from({ length: 14 }, (_, i) => {
                      const isScheduled = i === 5 || i === 11;
                      const isPublished = i < 3;
                      return (
                        <div
                          key={i}
                          className={`flex aspect-square items-center justify-center rounded text-[9px] ${
                            isScheduled
                              ? "bg-amber-500/20 text-amber-400 font-medium"
                              : isPublished
                                ? "bg-emerald-500/10 text-emerald-400/50"
                                : "bg-white/[0.02] text-white/15"
                          }`}
                        >
                          {i + 7}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </BentoCard>

              {/* ── Card 3: Auto-Save ───────────────────────────── */}
              <BentoCard delay={0.16}>
                <div className="flex h-full flex-col p-6">
                  <Save className="mb-4 size-5 text-emerald-400" />
                  <h3 className="mb-2 text-lg font-semibold text-white/90">
                    Never Lose Work
                  </h3>
                  <p className="text-[13px] leading-relaxed text-white/30">
                    Real-time auto-save syncs every keystroke to the cloud. Pick
                    up exactly where you left off, on any device.
                  </p>

                  {/* Save pulse animation */}
                  <div className="mt-auto flex items-center gap-3">
                    <div className="relative flex items-center justify-center">
                      <motion.div
                        className="absolute size-8 rounded-full bg-emerald-400/20"
                        animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
                        transition={{
                          duration: 2,
                          repeat: Number.POSITIVE_INFINITY,
                        }}
                      />
                      <div className="size-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="font-mono text-[11px] text-emerald-400/60">
                      Synced — 0ms ago
                    </div>
                  </div>
                </div>
              </BentoCard>

              {/* ── Card 4: Frontmatter Schema ──────────────────── */}
              <BentoCard delay={0.12}>
                <div className="flex h-full flex-col p-6">
                  <Command className="mb-4 size-5 text-blue-400" />
                  <h3 className="mb-2 text-lg font-semibold text-white/90">
                    Smart Frontmatter
                  </h3>
                  <p className="mb-4 text-[13px] leading-relaxed text-white/30">
                    Auto-detects schema from your repo. Define custom fields —
                    strings, dates, tags, selects — and Wryte builds the form.
                  </p>

                  {/* Mini schema visualization */}
                  <div className="mt-auto space-y-1.5">
                    {[
                      { key: "title", type: "string", required: true },
                      { key: "date", type: "date", required: true },
                      { key: "tags", type: "tags", required: false },
                      { key: "draft", type: "boolean", required: false },
                    ].map((field) => (
                      <div
                        key={field.key}
                        className="flex items-center gap-2 font-mono text-[10px]"
                      >
                        <span className="text-purple-400">{field.key}</span>
                        <span className="text-white/10">:</span>
                        <span className="text-amber-300/40">{field.type}</span>
                        {field.required && (
                          <span className="rounded bg-red-500/10 px-1 text-[8px] text-red-400/50">
                            req
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </BentoCard>

              {/* ── Card 5: AI Enhancement (coming soon) ────────── */}
              <BentoCard delay={0.2}>
                <div className="relative flex h-full flex-col p-6">
                  <Sparkles className="mb-4 size-5 text-pink-400" />
                  <h3 className="mb-2 text-lg font-semibold text-white/90">
                    AI-Powered Polish
                  </h3>
                  <p className="text-[13px] leading-relaxed text-white/30">
                    Tone shifts, SEO suggestions, and content improvements. Your
                    voice, amplified by AI.
                  </p>

                  {/* Coming soon badge */}
                  <div className="mt-auto">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-500/15 bg-pink-500/5 px-2.5 py-1 text-[10px] font-medium text-pink-400/60">
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 2,
                          repeat: Number.POSITIVE_INFINITY,
                        }}
                        className="size-1 rounded-full bg-pink-400"
                      />
                      Coming Soon
                    </span>
                  </div>
                </div>
              </BentoCard>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  WORKFLOW — Horizontal flow, not a numbered list              */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section
          id="workflow"
          className="relative overflow-hidden py-24 sm:py-32"
        >
          {/* Top rule */}
          <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

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

            {/* Horizontal flow */}
            <div className="relative">
              {/* Connecting line */}
              <div className="absolute left-0 right-0 top-12 hidden h-px bg-gradient-to-r from-amber-400/30 via-purple-400/30 to-emerald-400/30 lg:block" />

              <div className="grid gap-8 lg:grid-cols-3 lg:gap-4">
                {[
                  {
                    num: "01",
                    title: "Capture",
                    desc: "Open the editor. Start typing markdown. No config, no setup. Auto-save catches every thought.",
                    color: "text-amber-400",
                    dotColor: "bg-amber-400",
                    glowColor: "bg-amber-400/20",
                  },
                  {
                    num: "02",
                    title: "Refine",
                    desc: "Toggle split view. Preview renders live. Edit frontmatter through the form panel. Polish until it shines.",
                    color: "text-purple-400",
                    dotColor: "bg-purple-400",
                    glowColor: "bg-purple-400/20",
                  },
                  {
                    num: "03",
                    title: "Ship",
                    desc: "Hit publish. Wryte commits to your GitHub repo, generates the file path, and your content is live.",
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
                    {/* Dot on the line */}
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
                    <h3 className="mb-2 text-xl font-semibold text-white/90">
                      {step.title}
                    </h3>
                    <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-white/30 lg:mx-0">
                      {step.desc}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  CTA — Dramatic, minimal                                      */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section className="relative py-32 sm:py-40">
          <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          {/* Ambient CTA glow */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.04] blur-[100px]" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="relative z-10 mx-auto max-w-2xl px-6 text-center"
          >
            <Image
              src="/wryte-wordmark.png"
              alt="Wryte"
              width={280}
              height={120}
              className="mx-auto mb-10"
              style={{ width: 280, height: "auto" }}
            />

            <p className="mb-10 text-lg text-white/30">
              Stop juggling markdown files and deploy scripts.
              <br />
              Start shipping content that matters.
            </p>

            <MagneticButton
              href={isSignedIn ? "/dashboard" : "/sign-up"}
              className="group relative inline-flex h-14 items-center gap-3 rounded-xl bg-amber-500 px-10 text-[16px] font-semibold text-black transition-all hover:bg-amber-400 hover:shadow-xl hover:shadow-amber-500/20"
            >
              {isSignedIn ? "Open Dashboard" : "Start Writing — Free"}
              <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-1" />
            </MagneticButton>

            <div className="mt-6 flex items-center justify-center gap-5 text-[12px] text-white/20">
              <span>No credit card</span>
              <span className="size-0.5 rounded-full bg-white/20" />
              <span>GitHub login</span>
              <span className="size-0.5 rounded-full bg-white/20" />
              <span>Ships in seconds</span>
            </div>
          </motion.div>
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  FOOTER — Clean and minimal                                   */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <footer className="border-t border-white/[0.04] py-8">
          <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <Image
                src="/wryte-icon.png"
                alt="Wryte"
                width={18}
                height={18}
                className="rounded-[3px] opacity-40"
                style={{ width: 18, height: "auto" }}
              />
              <span className="text-[12px] text-white/20">
                &copy; {new Date().getFullYear()} Wryte
              </span>
            </div>
            <div className="flex items-center gap-5 text-[12px] text-white/20">
              <button
                type="button"
                onClick={() => scrollToSection("editor")}
                className="transition-colors hover:text-white/40"
              >
                Editor
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("features")}
                className="transition-colors hover:text-white/40"
              >
                Features
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("workflow")}
                className="transition-colors hover:text-white/40"
              >
                Workflow
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
