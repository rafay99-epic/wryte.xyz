"use client";

import { useUser } from "@clerk/nextjs";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  Command,
  Eye,
  GitBranch,
  Keyboard,
  Save,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

/* ── Star field ──────────────────────────────────────────────────────── */

function StarField() {
  const stars = useMemo(
    () =>
      Array.from({ length: 120 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 300,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        duration: Math.random() * 4 + 3,
        delay: Math.random() * 5,
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {stars.map((s) => (
        <motion.div
          key={s.id}
          className="absolute rounded-full bg-amber-200"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
          }}
          animate={{
            opacity: [s.opacity, s.opacity * 2, s.opacity],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: s.duration,
            repeat: Number.POSITIVE_INFINITY,
            delay: s.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ── Constellation node ──────────────────────────────────────────────── */

function ConstellationNode({
  icon: Icon,
  title,
  description,
  x,
  y,
  delay,
  color,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  x: string;
  y: string;
  delay: number;
  color: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className="absolute z-10"
      style={{ left: x, top: y }}
    >
      <div className="group relative flex flex-col items-center">
        {/* Glow */}
        <div
          className={`absolute -inset-4 rounded-full blur-2xl transition-opacity duration-500 group-hover:opacity-100 ${color === "amber" ? "bg-amber-500/10" : "bg-purple-500/10"} opacity-0`}
        />
        {/* Node dot */}
        <div
          className={`relative z-10 flex size-14 items-center justify-center rounded-full border ${color === "amber" ? "border-amber-400/30 bg-amber-400/10" : "border-purple-400/30 bg-purple-400/10"} shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:scale-110`}
        >
          <Icon
            className={`size-6 ${color === "amber" ? "text-amber-400" : "text-purple-400"}`}
          />
        </div>
        {/* Label */}
        <div className="mt-3 w-40 text-center">
          <h3 className="text-sm font-semibold text-white/80">{title}</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-white/30">
            {description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Typewriter ──────────────────────────────────────────────────────── */

function useTypewriter(
  lines: string[],
  speed = 40,
  lineDelay = 500,
  active = true,
) {
  const [output, setOutput] = useState<string[]>([]);
  const [cursorLine, setCursorLine] = useState(0);
  const [cursorChar, setCursorChar] = useState(0);

  useEffect(() => {
    if (!active || cursorLine >= lines.length) return;
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
  }, [active, cursorLine, cursorChar, lines, speed, lineDelay]);

  return { output, cursorLine };
}

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
  "**Wryte changes that.**",
];

/* ── Main page ───────────────────────────────────────────────────────── */

export default function ConstellationLanding() {
  const { isSignedIn, user } = useUser();
  const heroRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInView = useInView(editorRef, { once: true, margin: "-100px" });

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.7], [1, 0.95]);

  const { output, cursorLine } = useTypewriter(
    editorLines,
    35,
    400,
    editorInView,
  );

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="relative min-h-screen bg-[#06060B] text-white">
      <StarField />

      {/* ── Nebula gradients ─────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-[1]">
        <div className="absolute left-1/4 top-1/4 h-[700px] w-[700px] rounded-full bg-amber-500/[0.04] blur-[150px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[500px] w-[500px] rounded-full bg-purple-600/[0.05] blur-[130px]" />
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/[0.03] blur-[120px]" />
      </div>

      <div className="relative z-10">
        {/* ═══ HEADER ═══════════════════════════════════════════════════ */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
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
                  onClick={() => scrollTo(item.toLowerCase())}
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
                      />
                    ) : (
                      <div className="flex size-7 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-semibold text-amber-400">
                        {user?.firstName?.[0] ?? "U"}
                      </div>
                    )}
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

        {/* ═══ HERO ═════════════════════════════════════════════════════ */}
        <section
          ref={heroRef}
          className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6"
        >
          <motion.div
            style={{ opacity: heroOpacity, scale: heroScale }}
            className="relative flex flex-col items-center"
          >
            {/* Orbital rings around logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative mb-14"
            >
              <div className="relative">
                {/* Rings */}
                {[180, 260, 340].map((size, i) => (
                  <motion.div
                    key={size}
                    className="absolute left-1/2 top-1/2 rounded-full border border-amber-400"
                    style={{
                      width: size,
                      height: size,
                      marginLeft: -size / 2,
                      marginTop: -size / 2,
                      opacity: 0.06 - i * 0.015,
                    }}
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 20 + i * 15,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "linear",
                    }}
                  >
                    <div
                      className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-amber-400"
                      style={{ opacity: 0.3 - i * 0.08 }}
                    />
                  </motion.div>
                ))}

                {/* Purple orbit */}
                <motion.div
                  className="absolute left-1/2 top-1/2 rounded-full border border-purple-400"
                  style={{
                    width: 220,
                    height: 220,
                    marginLeft: -110,
                    marginTop: -110,
                    opacity: 0.05,
                  }}
                  animate={{ rotate: -360 }}
                  transition={{
                    duration: 30,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "linear",
                  }}
                >
                  <div className="absolute -top-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-purple-400 opacity-40" />
                </motion.div>

                <Image
                  src="/wryte-icon.png"
                  alt="Wryte"
                  width={90}
                  height={90}
                  className="relative z-10"
                  priority
                />
                <div className="absolute inset-0 z-0 scale-[2.5] rounded-full bg-amber-500/15 blur-3xl" />
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="text-center text-[clamp(2.5rem,7vw,5.5rem)] font-bold leading-[0.95] tracking-[-0.03em]"
            >
              <span className="block text-white/90">Your words,</span>
              <span className="relative block">
                <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-purple-400 bg-clip-text text-transparent">
                  among the stars
                </span>
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="mx-auto mt-8 max-w-lg text-center text-[17px] leading-relaxed text-white/30"
            >
              A markdown editor that publishes to GitHub.
              <br />
              Built for developers who ship content at the speed of thought.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.2 }}
              className="mt-10 flex items-center justify-center gap-4"
            >
              <Link
                href={isSignedIn ? "/dashboard" : "/sign-up"}
                className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-xl bg-amber-500 px-7 text-[15px] font-semibold text-black transition-all hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/20"
              >
                {isSignedIn ? "Go to Dashboard" : "Start Writing"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <button
                type="button"
                onClick={() => scrollTo("editor")}
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/[0.08] px-7 text-[15px] font-medium text-white/50 transition-all hover:border-white/20 hover:text-white/80"
              >
                See it in action
              </button>
            </motion.div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              className="flex flex-col items-center gap-2"
            >
              <span className="text-[10px] tracking-[0.3em] text-white/15 uppercase">
                Scroll
              </span>
              <div className="h-8 w-px bg-gradient-to-b from-white/20 to-transparent" />
            </motion.div>
          </motion.div>
        </section>

        {/* ═══ CONSTELLATION FEATURES ═══════════════════════════════════ */}
        <section id="features" className="relative py-32 sm:py-40">
          <div className="mx-auto max-w-[1100px] px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-8 text-center"
            >
              <p className="text-[13px] font-medium tracking-[0.15em] text-purple-400/60 uppercase">
                Capabilities
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                A constellation of features
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[15px] text-white/30">
                Every feature connected, working together like stars forming a
                greater picture.
              </p>
            </motion.div>

            {/* Constellation map — positioned nodes with SVG lines */}
            <div className="relative mx-auto mt-20 hidden h-[600px] max-w-[900px] lg:block">
              {/* SVG connecting lines */}
              <svg
                className="absolute inset-0 z-0"
                width="100%"
                height="100%"
                viewBox="0 0 900 600"
              >
                {/* Lines connecting nodes */}
                <motion.line
                  x1="170"
                  y1="100"
                  x2="450"
                  y2="80"
                  stroke="url(#amberGrad)"
                  strokeWidth="1"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.2 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, delay: 0.5 }}
                />
                <motion.line
                  x1="450"
                  y1="80"
                  x2="720"
                  y2="120"
                  stroke="url(#purpleGrad)"
                  strokeWidth="1"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.2 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, delay: 0.7 }}
                />
                <motion.line
                  x1="170"
                  y1="100"
                  x2="280"
                  y2="320"
                  stroke="url(#amberGrad)"
                  strokeWidth="1"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.15 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, delay: 0.9 }}
                />
                <motion.line
                  x1="450"
                  y1="80"
                  x2="500"
                  y2="300"
                  stroke="url(#purpleGrad)"
                  strokeWidth="1"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.15 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, delay: 1.1 }}
                />
                <motion.line
                  x1="720"
                  y1="120"
                  x2="650"
                  y2="340"
                  stroke="url(#amberGrad)"
                  strokeWidth="1"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.15 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, delay: 1.3 }}
                />
                <motion.line
                  x1="280"
                  y1="320"
                  x2="500"
                  y2="300"
                  stroke="url(#purpleGrad)"
                  strokeWidth="1"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.12 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, delay: 1.5 }}
                />
                <motion.line
                  x1="500"
                  y1="300"
                  x2="650"
                  y2="340"
                  stroke="url(#amberGrad)"
                  strokeWidth="1"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.12 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, delay: 1.7 }}
                />
                <defs>
                  <linearGradient id="amberGrad">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                  <linearGradient id="purpleGrad">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
              </svg>

              <ConstellationNode
                icon={GitBranch}
                title="GitHub Native"
                x="10%"
                y="8%"
                delay={0.3}
                color="amber"
                description="Connect repos, publish with clean commits and smart SHA tracking."
              />
              <ConstellationNode
                icon={Eye}
                title="Live Preview"
                x="42%"
                y="4%"
                delay={0.5}
                color="purple"
                description="Toggle split view to see rendered markdown instantly as you type."
              />
              <ConstellationNode
                icon={Clock}
                title="Schedule & Forget"
                x="72%"
                y="10%"
                delay={0.7}
                color="amber"
                description="Pick a date and time. Content goes live while you sleep."
              />
              <ConstellationNode
                icon={Save}
                title="Auto-Save"
                x="22%"
                y="45%"
                delay={0.9}
                color="purple"
                description="Every keystroke synced in real-time to the cloud."
              />
              <ConstellationNode
                icon={Command}
                title="Smart Frontmatter"
                x="48%"
                y="42%"
                delay={1.1}
                color="amber"
                description="Auto-detects schema from your repo and builds the form."
              />
              <ConstellationNode
                icon={Sparkles}
                title="AI Polish"
                x="65%"
                y="48%"
                delay={1.3}
                color="purple"
                description="Tone shifts, SEO suggestions, and content improvements."
              />
            </div>

            {/* Mobile grid fallback */}
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:hidden">
              {[
                {
                  icon: GitBranch,
                  title: "GitHub Native",
                  desc: "Connect repos, publish with clean commits.",
                  color: "amber",
                },
                {
                  icon: Eye,
                  title: "Live Preview",
                  desc: "See rendered markdown instantly.",
                  color: "purple",
                },
                {
                  icon: Clock,
                  title: "Schedule & Forget",
                  desc: "Content goes live while you sleep.",
                  color: "amber",
                },
                {
                  icon: Save,
                  title: "Auto-Save",
                  desc: "Every keystroke synced to the cloud.",
                  color: "purple",
                },
                {
                  icon: Command,
                  title: "Smart Frontmatter",
                  desc: "Auto-detects schema, builds forms.",
                  color: "amber",
                },
                {
                  icon: Sparkles,
                  title: "AI Polish",
                  desc: "Tone shifts, SEO, improvements.",
                  color: "purple",
                },
              ].map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
                >
                  <f.icon
                    className={`mb-3 size-5 ${f.color === "amber" ? "text-amber-400" : "text-purple-400"}`}
                  />
                  <h3 className="text-sm font-semibold text-white/80">
                    {f.title}
                  </h3>
                  <p className="mt-1 text-[12px] text-white/30">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ EDITOR ══════════════════════════════════════════════════ */}
        <section id="editor" className="relative py-24 sm:py-32">
          <div className="mx-auto max-w-[1100px] px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
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

            <motion.div
              ref={editorRef}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              {/* Starburst glow behind editor */}
              <div className="absolute -inset-8 rounded-3xl bg-gradient-to-br from-amber-500/10 via-transparent to-purple-500/10 blur-2xl" />

              <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A12] shadow-2xl shadow-black/50">
                {/* Title bar */}
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="size-[10px] rounded-full bg-[#ff5f57]" />
                      <div className="size-[10px] rounded-full bg-[#febc2e]" />
                      <div className="size-[10px] rounded-full bg-[#28c840]" />
                    </div>
                    <span className="ml-3 text-[11px] text-white/25">
                      shipping-faster.md
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {["Edit", "Split", "Preview"].map((m, i) => (
                      <div
                        key={m}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${i === 0 ? "bg-amber-500/15 text-amber-400" : "text-white/20"}`}
                      >
                        {m}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Editor content */}
                <div className="min-h-[350px] p-5 sm:p-6">
                  <div className="font-mono text-[13px] leading-[1.8] sm:text-sm">
                    {output.map((line, i) => (
                      <div key={i} className="flex">
                        <span className="mr-4 inline-block w-5 shrink-0 text-right text-white/10 select-none">
                          {i + 1}
                        </span>
                        <span>
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

                {/* Status bar */}
                <div className="flex items-center justify-between border-t border-white/[0.04] px-4 py-1.5">
                  <span className="text-[10px] text-white/15">
                    Markdown · UTF-8
                  </span>
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
                transition={{ delay: 1.5 }}
                className="absolute -right-3 top-1/4 hidden xl:block"
              >
                <div className="rounded-xl border border-white/[0.06] bg-[#0A0A12]/90 p-3 shadow-xl backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Eye className="size-3.5 text-purple-400" />
                    <span className="text-[11px] font-medium text-white/50">
                      Live Preview
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-white/25">
                    Toggle split view for
                    <br />
                    rendered output instantly
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.8 }}
                className="absolute -left-3 bottom-1/3 hidden xl:block"
              >
                <div className="rounded-xl border border-white/[0.06] bg-[#0A0A12]/90 p-3 shadow-xl backdrop-blur-sm">
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

        {/* ═══ WORKFLOW ════════════════════════════════════════════════ */}
        <section
          id="workflow"
          className="relative overflow-hidden py-24 sm:py-32"
        >
          <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          <div className="mx-auto max-w-[1100px] px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-16 text-center"
            >
              <p className="text-[13px] font-medium tracking-[0.15em] text-amber-400/60 uppercase">
                Workflow
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Three moves to launch
              </h2>
            </motion.div>

            <div className="relative">
              {/* Connecting constellation line */}
              <div className="absolute left-0 right-0 top-12 hidden h-px lg:block">
                <div className="h-full w-full bg-gradient-to-r from-amber-400/20 via-purple-400/20 to-amber-400/20" />
                {/* Animated traveling dot */}
                <motion.div
                  className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50"
                  animate={{ left: ["0%", "100%"] }}
                  transition={{
                    duration: 4,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "linear",
                  }}
                />
              </div>

              <div className="grid gap-8 lg:grid-cols-3 lg:gap-4">
                {[
                  {
                    num: "01",
                    title: "Capture",
                    desc: "Open the editor. Start typing markdown. Auto-save catches every thought.",
                    color: "text-amber-400",
                    dot: "bg-amber-400",
                    glow: "bg-amber-400/20",
                  },
                  {
                    num: "02",
                    title: "Refine",
                    desc: "Toggle split view. Preview renders live. Polish your frontmatter through the form.",
                    color: "text-purple-400",
                    dot: "bg-purple-400",
                    glow: "bg-purple-400/20",
                  },
                  {
                    num: "03",
                    title: "Ship",
                    desc: "Hit publish. Wryte commits to GitHub, generates file paths, and you're live.",
                    color: "text-amber-400",
                    dot: "bg-amber-400",
                    glow: "bg-amber-400/20",
                  },
                ].map((step, i) => (
                  <motion.div
                    key={step.num}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.2 }}
                    className="relative text-center lg:text-left"
                  >
                    <div className="mx-auto mb-6 flex size-24 items-center justify-center lg:mx-0">
                      <div className="relative">
                        <div
                          className={`absolute inset-0 scale-[3] rounded-full ${step.glow} blur-xl`}
                        />
                        <div
                          className={`relative z-10 size-6 rounded-full ${step.dot}`}
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

        {/* ═══ CTA ════════════════════════════════════════════════════= */}
        <section className="relative py-32 sm:py-40">
          <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          {/* Starburst gradient */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.06] blur-[120px]" />
            <div className="absolute left-1/3 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/[0.04] blur-[100px]" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative z-10 mx-auto max-w-2xl px-6 text-center"
          >
            <Image
              src="/wryte-wordmark.png"
              alt="Wryte"
              width={280}
              height={120}
              className="mx-auto mb-10"
            />
            <p className="mb-10 text-lg text-white/30">
              Stop juggling deploy scripts.
              <br />
              Start shipping content that matters.
            </p>
            <Link
              href={isSignedIn ? "/dashboard" : "/sign-up"}
              className="group relative inline-flex h-14 items-center gap-3 rounded-xl bg-amber-500 px-10 text-[16px] font-semibold text-black transition-all hover:bg-amber-400 hover:shadow-xl hover:shadow-amber-500/20"
            >
              {isSignedIn ? "Open Dashboard" : "Start Writing — Free"}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <div className="mt-6 flex items-center justify-center gap-5 text-[12px] text-white/20">
              <span>No credit card</span>
              <span className="size-0.5 rounded-full bg-white/20" />
              <span>GitHub login</span>
              <span className="size-0.5 rounded-full bg-white/20" />
              <span>Ships in seconds</span>
            </div>
          </motion.div>
        </section>

        {/* ═══ FOOTER ═════════════════════════════════════════════════ */}
        <footer className="border-t border-white/[0.04] py-8">
          <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <Image
                src="/wryte-icon.png"
                alt="Wryte"
                width={18}
                height={18}
                className="rounded-[3px] opacity-40"
              />
              <span className="text-[12px] text-white/20">
                &copy; {new Date().getFullYear()} Wryte
              </span>
            </div>
            <div className="flex items-center gap-5 text-[12px] text-white/20">
              {["editor", "features", "workflow"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => scrollTo(s)}
                  className="capitalize transition-colors hover:text-white/40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
