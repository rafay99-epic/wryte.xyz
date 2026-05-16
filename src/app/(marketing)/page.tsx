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
  CheckCircle2,
  Clock,
  Command,
  Eye,
  GalleryVerticalEnd,
  GitBranch,
  Keyboard,
  Layers,
  MousePointerClick,
  Save,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandIcon } from "@/components/branding/brand-icon";
import { MarketingThemeToggle } from "@/components/layout/marketing-theme-toggle";
import { APP_RELEASE_LABEL } from "@/lib/release";

/* ------------------------------------------------------------------ */
/*  Typewriter hook                                                     */
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
/*  Magnetic button                                                     */
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
/*  Marquee                                                             */
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
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-linear-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-linear-to-l from-background to-transparent" />
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
              className="whitespace-nowrap text-sm font-medium tracking-[0.2em] text-foreground/65 dark:text-foreground/10 uppercase"
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
/*  Orbital ring                                                        */
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
/*  Bento card                                                          */
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
      className={`group relative overflow-hidden rounded-2xl border border-foreground/[0.15] bg-foreground/[0.02] transition-colors duration-500 hover:border-foreground/[0.25] hover:bg-foreground/[0.04] dark:border-foreground/[0.06] dark:bg-foreground/[0.02] dark:hover:border-foreground/[0.12] dark:hover:bg-foreground/[0.04] ${className ?? ""}`}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Editor lines for typewriter demo                                    */
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
/*  Board card mock                                                     */
/* ------------------------------------------------------------------ */

function BoardCardMock({
  title,
  slug,
  words,
  age,
  ageColor,
  tags,
  isDragging,
  className,
}: {
  title: string;
  slug: string;
  words: string;
  age: string;
  ageColor: string;
  tags: string[];
  isDragging?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-foreground/[0.12] dark:border-foreground/[0.06] bg-card px-3 py-2.5 transition-all ${isDragging ? "rotate-2 scale-105 shadow-xl shadow-amber-500/10 border-amber-400/30" : ""} ${className ?? ""}`}
    >
      <p className="text-[12px] font-medium text-foreground/85 dark:text-foreground/70">
        {title}
      </p>
      <p className="mt-0.5 truncate font-mono text-[10px] text-foreground/50 dark:text-foreground/20">
        /{slug}
      </p>
      <div className="mt-2 flex items-center gap-2 text-[9px] text-foreground/50 dark:text-foreground/30">
        <span>{words} words</span>
        <span className="text-foreground/20">·</span>
        <span className={ageColor}>{age}</span>
      </div>
      {tags.length > 0 && (
        <div className="mt-1.5 flex gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-foreground/[0.04] dark:bg-foreground/[0.06] px-1.5 py-0.5 text-[8px] font-medium text-foreground/50 dark:text-foreground/30"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main landing page                                                   */
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

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen overflow-x-hidden bg-background text-foreground"
    >
      {/* Noise texture */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] hidden opacity-[0.025] dark:block"
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
          className="fixed top-0 right-0 left-0 z-50 border-b border-foreground/[0.06] bg-background/80 backdrop-blur-xl"
        >
          <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <BrandIcon width={28} height={28} className="rounded-md" />
              <span className="text-[15px] font-semibold tracking-tight text-foreground/80">
                wryte
              </span>
            </Link>

            <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
              {["Features", "Editor", "Board"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => scrollToSection(item.toLowerCase())}
                  className="rounded-lg px-3.5 py-1.5 text-[13px] text-foreground/65 dark:text-foreground/35 transition-colors hover:bg-foreground/5 hover:text-foreground/70"
                >
                  {item}
                </button>
              ))}
              <Link
                href="/how-it-works"
                className="rounded-lg px-3.5 py-1.5 text-[13px] text-foreground/65 dark:text-foreground/35 transition-colors hover:bg-foreground/5 hover:text-foreground/70"
              >
                How it Works
              </Link>
            </nav>

            <div className="flex items-center gap-2">
              <MarketingThemeToggle />
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
                    className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-foreground/5"
                  >
                    {user?.imageUrl ? (
                      <Image
                        src={user.imageUrl}
                        alt={user.fullName ?? ""}
                        width={28}
                        height={28}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="flex size-7 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-semibold text-amber-400">
                        {user?.firstName?.[0] ?? "U"}
                      </div>
                    )}
                    <span className="hidden text-[13px] font-medium text-foreground/70 sm:block">
                      {user?.firstName}
                    </span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    className="hidden rounded-lg px-3.5 py-1.5 text-[13px] text-foreground/70 dark:text-foreground/40 transition-colors hover:text-foreground/80 sm:block"
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
        {/*  HERO                                                         */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section
          ref={heroRef}
          className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6"
        >
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
                  <BrandIcon
                    width={100}
                    height={100}
                    className="relative z-10"
                    priority
                  />
                  <div className="absolute inset-0 z-0 scale-[2] rounded-full bg-amber-500/20 blur-3xl" />
                </div>
              </motion.div>
            </motion.div>

            <div className="relative text-center">
              <motion.h1
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.4,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="text-[clamp(2.5rem,7vw,5.5rem)] font-bold leading-[1.08] tracking-[-0.03em]"
              >
                <span className="block text-foreground/90">Write.</span>
                <span className="block text-foreground/90">Manage.</span>
                <span className="relative block">
                  <span className="text-amber-400">Publish.</span>
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
                className="mx-auto mt-8 max-w-lg text-[17px] leading-relaxed text-foreground/65 dark:text-foreground/30"
              >
                A complete content workspace for developers.
                <br />
                Write in markdown. Manage on a kanban board.
                <br />
                Publish to GitHub with one click.
              </motion.p>

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
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-foreground/[0.2] dark:border-foreground/[0.08] px-7 text-[15px] font-medium text-foreground/75 dark:text-foreground/50 transition-all hover:border-foreground/20 hover:text-foreground/80"
                >
                  See it in action
                </MagneticButton>
              </motion.div>
            </div>
          </motion.div>

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
              <span className="text-[10px] font-medium tracking-[0.3em] text-foreground/70 dark:text-foreground/15 uppercase">
                Scroll
              </span>
              <div className="h-8 w-px bg-gradient-to-b from-foreground/20 to-transparent" />
            </motion.div>
          </motion.div>
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  MARQUEE                                                      */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <div className="border-y border-foreground/[0.12] dark:border-foreground/[0.04] py-5">
          <Marquee
            items={[
              "Markdown Editor",
              "Kanban Board",
              "GitHub Publishing",
              "Live Preview",
              "Drag & Drop",
              "Auto-Save",
              "Scheduling",
              "Keyboard Shortcuts",
              "Smart Frontmatter",
              "Inline Editing",
              "Multi-Select",
              "Dark Mode",
              "AI Polish",
            ]}
          />
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  STATEMENT                                                    */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section className="py-32 sm:py-40">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1 }}
            className="mx-auto max-w-[900px] px-6"
          >
            <p className="text-center text-[clamp(1.25rem,3vw,2rem)] font-light leading-[1.5] tracking-[-0.01em] text-foreground/75 dark:text-foreground/50">
              We built Wryte because{" "}
              <span className="text-foreground/90">
                managing content as a developer
              </span>{" "}
              shouldn&apos;t mean juggling files and deploy scripts.{" "}
              <span className="text-foreground/90">
                Write in a real editor, drag cards across a board,{" "}
              </span>
              and ship to GitHub with{" "}
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
        {/*  LIVE EDITOR                                                  */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section id="editor" className="relative py-24 sm:py-32">
          <div className="mx-auto max-w-[1100px] px-6">
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
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-foreground/55 dark:text-foreground/25">
                A distraction-free markdown editor with split preview, syntax
                highlighting, and keyboard shortcuts you already know.
              </p>
            </motion.div>

            <motion.div
              ref={editorRef}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-amber-500/20 via-transparent to-purple-500/10 blur-sm" />

              <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.2] dark:border-foreground/[0.08] bg-card shadow-2xl shadow-black/60">
                {/* Title bar */}
                <div className="flex items-center justify-between border-b border-foreground/[0.15] dark:border-foreground/[0.06] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="size-[10px] rounded-full bg-[#ff5f57]" />
                      <div className="size-[10px] rounded-full bg-[#febc2e]" />
                      <div className="size-[10px] rounded-full bg-[#28c840]" />
                    </div>
                    <div className="ml-3 flex items-center gap-1.5 rounded-md bg-foreground/[0.04] px-2.5 py-1">
                      <Layers className="size-3 text-foreground/75 dark:text-foreground/20" />
                      <span className="text-[11px] text-foreground/55 dark:text-foreground/25">
                        my-blog
                      </span>
                      <span className="text-[11px] text-foreground/65 dark:text-foreground/10">
                        /
                      </span>
                      <span className="text-[11px] text-foreground/70 dark:text-foreground/40">
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
                            : "text-foreground/75 hover:text-foreground/70 dark:text-foreground/20 dark:hover:text-foreground/40"
                        }`}
                      >
                        {mode}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Editor + sidebar */}
                <div className="flex">
                  {/* Frontmatter sidebar */}
                  <div className="hidden w-56 shrink-0 border-r border-foreground/[0.12] dark:border-foreground/[0.04] p-4 lg:block">
                    <div className="mb-3 text-[10px] font-semibold tracking-[0.15em] text-foreground/75 dark:text-foreground/20 uppercase">
                      Frontmatter
                    </div>
                    {[
                      { label: "Title", value: "Shipping Faster..." },
                      { label: "Date", value: "2026-04-07" },
                      { label: "Tags", value: "devtools, workflow" },
                      { label: "Draft", value: "false" },
                    ].map((field) => (
                      <div key={field.label} className="mb-3">
                        <div className="text-[10px] font-medium text-foreground/55 dark:text-foreground/25">
                          {field.label}
                        </div>
                        <div className="mt-0.5 rounded bg-foreground/[0.03] px-2 py-1 text-[11px] text-foreground/70 dark:text-foreground/40">
                          {field.value}
                        </div>
                      </div>
                    ))}

                    <div className="mt-6 border-t border-foreground/[0.12] dark:border-foreground/[0.04] pt-4">
                      <div className="mb-2 text-[10px] font-semibold tracking-[0.15em] text-foreground/75 dark:text-foreground/20 uppercase">
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
                          <span className="mr-4 inline-block w-5 shrink-0 text-right text-foreground/65 dark:text-foreground/10 select-none">
                            {i + 1}
                          </span>
                          <span>
                            {line.startsWith("---") ? (
                              <span className="text-foreground/70 dark:text-foreground/15">
                                {line}
                              </span>
                            ) : line.startsWith("#") ? (
                              <span className="font-semibold text-foreground/80">
                                {line}
                              </span>
                            ) : line.includes(":") && i < 6 ? (
                              <>
                                <span className="text-purple-400">
                                  {line.split(":")[0]}
                                </span>
                                <span className="text-foreground/75 dark:text-foreground/20">
                                  :
                                </span>
                                <span className="text-amber-300/70">
                                  {line.slice(line.indexOf(":") + 1)}
                                </span>
                              </>
                            ) : line.includes("**") ? (
                              <span className="text-foreground/70 dark:text-foreground/40">
                                {line.split("**").map((part, j) =>
                                  j % 2 === 1 ? (
                                    <span
                                      key={j}
                                      className="font-semibold text-foreground/80"
                                    >
                                      {part}
                                    </span>
                                  ) : (
                                    <span key={j}>{part}</span>
                                  ),
                                )}
                              </span>
                            ) : (
                              <span className="text-foreground/65 dark:text-foreground/35">
                                {line}
                              </span>
                            )}
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

                {/* Status bar */}
                <div className="flex items-center justify-between border-t border-foreground/[0.12] dark:border-foreground/[0.04] px-4 py-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-foreground/70 dark:text-foreground/15">
                      Markdown
                    </span>
                    <span className="text-[10px] text-foreground/70 dark:text-foreground/15">
                      UTF-8
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400/50">
                    <Save className="size-3" />
                    Saved
                  </div>
                </div>
              </div>

              {/* Floating annotations */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.5, duration: 0.6 }}
                className="absolute -right-3 top-1/4 hidden xl:block"
              >
                <div className="rounded-xl border border-foreground/[0.15] dark:border-foreground/[0.06] bg-card/90 p-3 shadow-xl backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Eye className="size-3.5 text-purple-400" />
                    <span className="text-[11px] font-medium text-foreground/75 dark:text-foreground/50">
                      Live Preview
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-foreground/55 dark:text-foreground/25">
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
                <div className="rounded-xl border border-foreground/[0.15] dark:border-foreground/[0.06] bg-card/90 p-3 shadow-xl backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Keyboard className="size-3.5 text-amber-400" />
                    <span className="text-[11px] font-medium text-foreground/75 dark:text-foreground/50">
                      Keyboard First
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-foreground/55 dark:text-foreground/25">
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
        {/*  KANBAN BOARD — Visual board mockup                           */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section id="board" className="relative py-24 sm:py-32">
          <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />

          <div className="mx-auto max-w-[1100px] px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
              className="mb-12"
            >
              <p className="text-[13px] font-medium tracking-[0.15em] text-purple-400/60 uppercase">
                The Board
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Your content pipeline, visualized
              </h2>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-foreground/55 dark:text-foreground/25">
                Drag articles between columns. See word counts, age indicators,
                and tags at a glance. Navigate with vim keys. Bulk-move with
                multi-select.
              </p>
            </motion.div>

            {/* Board mockup */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-purple-500/15 via-transparent to-amber-500/10 blur-sm" />

              <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.2] dark:border-foreground/[0.08] bg-card shadow-2xl shadow-black/60">
                {/* Board title bar */}
                <div className="flex items-center justify-between border-b border-foreground/[0.15] dark:border-foreground/[0.06] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="size-[10px] rounded-full bg-[#ff5f57]" />
                      <div className="size-[10px] rounded-full bg-[#febc2e]" />
                      <div className="size-[10px] rounded-full bg-[#28c840]" />
                    </div>
                    <div className="ml-3 flex items-center gap-1.5 rounded-md bg-foreground/[0.04] px-2.5 py-1">
                      <GalleryVerticalEnd className="size-3 text-foreground/75 dark:text-foreground/20" />
                      <span className="text-[11px] text-foreground/70 dark:text-foreground/40">
                        Content Board
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {["Board", "Table"].map((view, i) => (
                      <div
                        key={view}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          i === 0
                            ? "bg-purple-500/15 text-purple-400"
                            : "text-foreground/75 dark:text-foreground/20"
                        }`}
                      >
                        {view}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Board columns */}
                <div className="flex gap-3 overflow-x-auto p-4">
                  {/* Draft column */}
                  <div className="min-w-[220px] flex-1 rounded-xl border border-amber-500/10 border-t-amber-500/30 border-t-[3px] bg-foreground/[0.01]">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span className="text-[12px] font-semibold text-foreground/80 dark:text-foreground/60">
                        Draft
                      </span>
                      <span className="rounded-full bg-amber-500/10 px-1.5 py-0 text-[10px] font-semibold text-amber-400">
                        3
                      </span>
                    </div>
                    <div className="space-y-2 px-2 pb-2">
                      <BoardCardMock
                        title="Getting Started Guide"
                        slug="getting-started"
                        words="1.2k"
                        age="2h"
                        ageColor="text-emerald-400"
                        tags={["docs"]}
                      />
                      <BoardCardMock
                        title="API Reference v2"
                        slug="api-reference-v2"
                        words="3.4k"
                        age="1d"
                        ageColor="text-amber-400"
                        tags={["api", "docs"]}
                        isDragging
                      />
                      <BoardCardMock
                        title="Migration Guide"
                        slug="migration-guide"
                        words="890"
                        age="3d"
                        ageColor="text-red-400"
                        tags={["guide"]}
                      />
                    </div>
                  </div>

                  {/* Review column */}
                  <div className="min-w-[220px] flex-1 rounded-xl border border-purple-500/10 border-t-purple-500/30 border-t-[3px] bg-foreground/[0.01]">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span className="text-[12px] font-semibold text-foreground/80 dark:text-foreground/60">
                        Review
                      </span>
                      <span className="rounded-full bg-purple-500/10 px-1.5 py-0 text-[10px] font-semibold text-purple-400">
                        2
                      </span>
                    </div>
                    <div className="space-y-2 px-2 pb-2">
                      <BoardCardMock
                        title="Shipping Faster with Wryte"
                        slug="shipping-faster"
                        words="2.1k"
                        age="4h"
                        ageColor="text-emerald-400"
                        tags={["blog", "devtools"]}
                      />
                      <BoardCardMock
                        title="Content Strategy 2026"
                        slug="content-strategy"
                        words="1.8k"
                        age="12h"
                        ageColor="text-amber-400"
                        tags={["strategy"]}
                      />
                    </div>
                  </div>

                  {/* Published column */}
                  <div className="min-w-[220px] flex-1 rounded-xl border border-emerald-500/10 border-t-emerald-500/30 border-t-[3px] bg-foreground/[0.01]">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <span className="text-[12px] font-semibold text-foreground/80 dark:text-foreground/60">
                        Published
                      </span>
                      <span className="rounded-full bg-emerald-500/10 px-1.5 py-0 text-[10px] font-semibold text-emerald-400">
                        4
                      </span>
                    </div>
                    <div className="space-y-2 px-2 pb-2">
                      <BoardCardMock
                        title="Why We Built Wryte"
                        slug="why-we-built-wryte"
                        words="1.5k"
                        age="2d"
                        ageColor="text-amber-400"
                        tags={["blog"]}
                      />
                      <BoardCardMock
                        title="Markdown Best Practices"
                        slug="markdown-best-practices"
                        words="2.8k"
                        age="5d"
                        ageColor="text-red-400"
                        tags={["guide", "markdown"]}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating annotations */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="absolute -right-3 top-1/4 hidden xl:block"
              >
                <div className="rounded-xl border border-foreground/[0.15] dark:border-foreground/[0.06] bg-card/90 p-3 shadow-xl backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <MousePointerClick className="size-3.5 text-amber-400" />
                    <span className="text-[11px] font-medium text-foreground/75 dark:text-foreground/50">
                      Drag & Drop
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-foreground/55 dark:text-foreground/25">
                    Grab any card and move
                    <br />
                    it to another column
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.1, duration: 0.6 }}
                className="absolute -left-3 bottom-1/4 hidden xl:block"
              >
                <div className="rounded-xl border border-foreground/[0.15] dark:border-foreground/[0.06] bg-card/90 p-3 shadow-xl backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Keyboard className="size-3.5 text-purple-400" />
                    <span className="text-[11px] font-medium text-foreground/75 dark:text-foreground/50">
                      Vim Navigation
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-foreground/55 dark:text-foreground/25">
                    j/k to move, m+1-9
                    <br />
                    to move cards between columns
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  BENTO GRID                                                   */}
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

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[260px_260px_260px]">
              {/* Card 1: GitHub Publishing (large, spans 2 rows) */}
              <BentoCard className="lg:row-span-2" delay={0}>
                <div className="flex h-full flex-col p-6">
                  <GitBranch className="mb-4 size-5 text-amber-400" />
                  <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                    GitHub Native
                  </h3>
                  <p className="mb-6 text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                    Connect any repo, configure content paths, and publish.
                    Wryte generates clean commits and tracks file SHAs for smart
                    create-or-update logic. Diff-before-sync ensures no wasted
                    operations.
                  </p>

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
                        className="flex items-start gap-3 rounded-lg bg-foreground/[0.02] px-3 py-2 transition-colors group-hover:bg-foreground/[0.04]"
                      >
                        <div
                          className={`mt-1.5 size-1.5 shrink-0 rounded-full ${commit.color}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-[11px] text-foreground/70 dark:text-foreground/40">
                            {commit.msg}
                          </div>
                          <div className="text-[10px] text-foreground/70 dark:text-foreground/15">
                            {commit.time}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </BentoCard>

              {/* Card 2: Kanban Board */}
              <BentoCard delay={0.08}>
                <div className="flex h-full flex-col p-6">
                  <GalleryVerticalEnd className="mb-4 size-5 text-purple-400" />
                  <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                    Kanban Board
                  </h3>
                  <p className="text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                    Drag cards between columns. Rename inline, edit tags,
                    preview on hover. Collapsible columns keep things tidy.
                  </p>

                  <div className="mt-auto flex gap-2">
                    {["Draft", "Review", "Live"].map((col, i) => (
                      <div
                        key={col}
                        className="flex-1 rounded-md bg-foreground/[0.03] px-2 py-1.5 text-center"
                      >
                        <div className="text-[9px] font-semibold text-foreground/50 dark:text-foreground/25">
                          {col}
                        </div>
                        <div className="mt-1 text-[16px] font-bold text-foreground/70 dark:text-foreground/40">
                          {[3, 2, 4][i]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </BentoCard>

              {/* Card 3: Schedule & Forget */}
              <BentoCard delay={0.16}>
                <div className="flex h-full flex-col p-6">
                  <Clock className="mb-4 size-5 text-emerald-400" />
                  <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                    Schedule & Forget
                  </h3>
                  <p className="text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                    Pick a date and time. Wryte&apos;s cron engine handles the
                    rest — your content goes live while you sleep.
                  </p>

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
                                : "bg-foreground/[0.02] text-foreground/70 dark:text-foreground/15"
                          }`}
                        >
                          {i + 7}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </BentoCard>

              {/* Card 4: Keyboard First (large, spans 2 cols) */}
              <BentoCard className="sm:col-span-2" delay={0.12}>
                <div className="flex h-full flex-col p-6">
                  <Keyboard className="mb-4 size-5 text-amber-400" />
                  <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                    Keyboard First
                  </h3>
                  <p className="mb-4 text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                    Every action has a shortcut. Navigate the board with vim
                    keys, format text with familiar combos, move cards without
                    touching the mouse.
                  </p>

                  <div className="mt-auto grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                    {[
                      { keys: "j / k", action: "Navigate cards" },
                      { keys: "h / l", action: "Switch columns" },
                      { keys: "m + 1-9", action: "Move to column" },
                      { keys: "Ctrl+B", action: "Bold text" },
                      { keys: "Ctrl+K", action: "Insert link" },
                      { keys: "Ctrl+S", action: "Force save" },
                    ].map((shortcut) => (
                      <div
                        key={shortcut.keys}
                        className="flex items-center gap-2"
                      >
                        <kbd className="rounded bg-foreground/[0.05] dark:bg-foreground/[0.08] px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground/60 dark:text-foreground/40">
                          {shortcut.keys}
                        </kbd>
                        <span className="text-[11px] text-foreground/50 dark:text-foreground/25">
                          {shortcut.action}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </BentoCard>

              {/* Card 5: Auto-Save */}
              <BentoCard delay={0.2}>
                <div className="flex h-full flex-col p-6">
                  <Save className="mb-4 size-5 text-emerald-400" />
                  <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                    Never Lose Work
                  </h3>
                  <p className="text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                    Real-time auto-save syncs every keystroke to the cloud. Pick
                    up exactly where you left off, on any device.
                  </p>

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

              {/* Card 6: Smart Frontmatter */}
              <BentoCard delay={0.24}>
                <div className="flex h-full flex-col p-6">
                  <Command className="mb-4 size-5 text-blue-400" />
                  <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                    Smart Frontmatter
                  </h3>
                  <p className="mb-4 text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                    Auto-detects schema from your repo. Define custom fields and
                    Wryte builds the form.
                  </p>

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
                        <span className="text-foreground/65 dark:text-foreground/10">
                          :
                        </span>
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

              {/* Card 7: Multi-Select & Bulk Actions */}
              <BentoCard delay={0.28}>
                <div className="flex h-full flex-col p-6">
                  <CheckCircle2 className="mb-4 size-5 text-purple-400" />
                  <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                    Bulk Actions
                  </h3>
                  <p className="text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                    Select multiple articles with checkboxes. Move, publish, or
                    delete in batch — across both board and table views.
                  </p>

                  <div className="mt-auto space-y-1.5">
                    {[
                      "Move 3 articles to Review",
                      "Publish 5 to GitHub",
                      "Delete 2 drafts",
                    ].map((action) => (
                      <div
                        key={action}
                        className="flex items-center gap-2 rounded bg-foreground/[0.03] px-2 py-1.5 text-[10px] text-foreground/50 dark:text-foreground/30"
                      >
                        <CheckCircle2 className="size-3 text-purple-400/50" />
                        {action}
                      </div>
                    ))}
                  </div>
                </div>
              </BentoCard>

              {/* Card 8: AI Enhancement (coming soon) */}
              <BentoCard delay={0.32}>
                <div className="relative flex h-full flex-col p-6">
                  <Sparkles className="mb-4 size-5 text-pink-400" />
                  <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                    AI-Powered Polish
                  </h3>
                  <p className="text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                    Tone shifts, SEO suggestions, frontmatter generation, and
                    content improvements. Your voice, amplified by AI.
                  </p>

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
        {/*  WORKFLOW                                                     */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section
          id="workflow"
          className="relative overflow-hidden py-24 sm:py-32"
        >
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

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  CTA                                                          */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <section className="relative py-32 sm:py-40">
          <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />

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
            <div className="mx-auto mb-10 flex items-center justify-center gap-3">
              <BrandIcon width={64} height={64} />
              <span className="text-6xl font-bold leading-none tracking-tight text-foreground">
                wryte
              </span>
            </div>

            <p className="mb-10 text-lg text-foreground/65 dark:text-foreground/30">
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

            <div className="mt-6 flex items-center justify-center gap-5 text-[12px] text-foreground/75 dark:text-foreground/20">
              <span>No credit card</span>
              <span className="size-0.5 rounded-full bg-foreground/20" />
              <span>GitHub login</span>
              <span className="size-0.5 rounded-full bg-foreground/20" />
              <span>Ships in seconds</span>
            </div>
          </motion.div>
        </section>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  FOOTER                                                       */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <footer className="border-t border-foreground/[0.08] dark:border-foreground/[0.04] py-8">
          <div className="mx-auto max-w-[1100px] px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrandIcon
                  width={18}
                  height={18}
                  className="rounded-[3px] opacity-40"
                />
                <span className="text-[12px] text-foreground/40 dark:text-foreground/20">
                  &copy; {new Date().getFullYear()} Wryte
                </span>
              </div>
              <div className="flex items-center gap-5 text-[12px] text-foreground/40 dark:text-foreground/20">
                <Link
                  href="/how-it-works"
                  className="transition-colors hover:text-foreground/70"
                >
                  How it Works
                </Link>
                <Link
                  href="/contact"
                  className="transition-colors hover:text-foreground/70"
                >
                  Contact
                </Link>
                <Link
                  href="/terms"
                  className="transition-colors hover:text-foreground/70"
                >
                  Terms
                </Link>
                <Link
                  href="/privacy"
                  className="transition-colors hover:text-foreground/70"
                >
                  Privacy
                </Link>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-foreground/[0.06] dark:border-foreground/[0.03] pt-5">
              <p className="text-[11px] text-foreground/30 dark:text-foreground/15">
                {APP_RELEASE_LABEL} · Built by{" "}
                <a
                  href="https://rafay99.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground/50"
                >
                  Abdul Rafay
                </a>
              </p>
              <a
                href="https://syntaxlabtechnology.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-foreground/30 dark:text-foreground/15 transition-colors hover:text-foreground/50"
              >
                Syntax Lab Technology
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
