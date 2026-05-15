"use client";

import { useMutation } from "convex/react";
import { ArrowLeft, CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { BrandIcon } from "@/components/branding/brand-icon";
import { MarketingThemeToggle } from "@/components/layout/marketing-theme-toggle";
import { AnimatedSection as Section } from "@/features/marketing/components/animated-section";
import { api } from "../../../../convex/_generated/api";

export default function ContactPage() {
  const submitTicket = useMutation(api.support.tickets.submitFromMarketing);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    subject.trim().length > 0 &&
    message.trim().length > 0;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setIsSending(true);
      try {
        await submitTicket({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        });
        setSent(true);
      } catch {
        toast.error("Failed to send message. Please try again.");
      } finally {
        setIsSending(false);
      }
    },
    [canSubmit, name, email, subject, message, submitTicket],
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Noise texture */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] hidden opacity-[0.025] dark:block"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[500px] w-[600px] -translate-x-1/2 rounded-full bg-amber-500/[0.04] blur-[120px]" />
        <div className="absolute right-1/4 top-1/2 h-[300px] w-[300px] rounded-full bg-purple-600/[0.03] blur-[100px]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="fixed top-0 right-0 left-0 z-50 border-b border-foreground/[0.06] bg-background/80 backdrop-blur-xl">
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
                Home
              </Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="flex flex-col items-center px-6 pt-32 pb-8">
          <Section>
            <div className="text-center">
              <Mail className="mx-auto mb-4 size-8 text-amber-400/80" />
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Get in touch
              </h1>
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-foreground/55 dark:text-foreground/25">
                Bug report, feature request, or just a question — we&apos;d love
                to hear from you.
              </p>
            </div>
          </Section>
        </section>

        {/* Form — flat, no card wrapper */}
        <section className="mx-auto max-w-md px-6 pb-32">
          <Section delay={0.1}>
            {sent ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="mx-auto mb-4 size-10 text-emerald-500" />
                <h2 className="text-lg font-semibold">Message sent</h2>
                <p className="mt-2 text-sm text-foreground/50">
                  Thanks for reaching out. We&apos;ll get back to you soon.
                </p>
                <Link
                  href="/"
                  className="mt-8 inline-flex h-10 items-center gap-2 rounded-xl bg-amber-500 px-6 text-[13px] font-semibold text-black transition-all hover:bg-amber-400"
                >
                  Back to Home
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="mb-1.5 block text-xs font-medium text-foreground/60"
                    >
                      Name
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      required
                      disabled={isSending}
                      className="h-10 w-full rounded-lg border border-foreground/[0.12] dark:border-foreground/[0.08] bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-foreground/25 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="contact-email"
                      className="mb-1.5 block text-xs font-medium text-foreground/60"
                    >
                      Email
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      disabled={isSending}
                      className="h-10 w-full rounded-lg border border-foreground/[0.12] dark:border-foreground/[0.08] bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-foreground/25 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="contact-subject"
                    className="mb-1.5 block text-xs font-medium text-foreground/60"
                  >
                    Subject
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="What's this about?"
                    required
                    disabled={isSending}
                    className="h-10 w-full rounded-lg border border-foreground/[0.12] dark:border-foreground/[0.08] bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-foreground/25 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-message"
                    className="mb-1.5 block text-xs font-medium text-foreground/60"
                  >
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what's on your mind..."
                    required
                    disabled={isSending}
                    rows={5}
                    className="w-full rounded-lg border border-foreground/[0.12] dark:border-foreground/[0.08] bg-transparent px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-foreground/25 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit || isSending}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-[14px] font-semibold text-black transition-all hover:bg-amber-400 disabled:pointer-events-none disabled:opacity-40"
                >
                  {isSending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {isSending ? "Sending..." : "Send Message"}
                </button>
              </form>
            )}
          </Section>
        </section>

        {/* Footer */}
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
                v0.5.1 · build 72 · Built by{" "}
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
