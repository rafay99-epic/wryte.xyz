"use client";

import {
  AtSign,
  Check,
  ExternalLink,
  Eye,
  Flame,
  Globe,
  Link2,
  Mail,
  PenLine,
  Rss,
  Sparkles,
  Type,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ActivityHeatmap } from "@/features/dashboard/components/activity-heatmap";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { accentHex } from "./accents";

type PostItem = {
  title: string;
  url: string;
  publishedAt: number;
  projectName: string;
};

export type PublicProfileData = {
  username: string;
  name: string;
  imageUrl?: string;
  bio?: string;
  joinedAt: number;
  accent?: string;
  feedUrl?: string;
  socialLinks: { label: string; url: string }[];
  sites: { name: string; url: string }[];
  topics: string[];
  featured?: PostItem;
  posts: PostItem[];
  stats?: {
    totalPublished: number;
    totalWords: number;
    currentStreak: number;
    longestStreak: number;
  };
  heatmap?: { date: string; words: number }[];
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function iconForUrl(url: string): React.ElementType {
  if (url.startsWith("mailto:")) return Mail;
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return Link2;
  }
  if (host.includes("rss") || url.includes("/feed") || url.includes("/rss")) {
    return Rss;
  }
  if (
    host === "x.com" ||
    host.includes("twitter") ||
    host.includes("mastodon") ||
    host.includes("bsky") ||
    host.includes("threads")
  ) {
    return AtSign;
  }
  return Globe;
}

export function PublicProfile({
  profile,
  preview,
}: {
  profile: PublicProfileData;
  preview?: { isPublic: boolean };
}) {
  const [copied, setCopied] = useState(false);
  const accent = accentHex(profile.accent);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Profile link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — copy it from the address bar.");
    }
  };

  const lastPublished = Math.max(
    profile.featured?.publishedAt ?? 0,
    profile.posts[0]?.publishedAt ?? 0,
  );

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ "--pa": accent } as CSSProperties}
    >
      {preview && (
        <div className="sticky top-0 z-20 flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs font-medium text-amber-700 backdrop-blur dark:text-amber-300">
          <Eye className="size-3.5 shrink-0" />
          {preview.isPublic
            ? "Preview — this profile is live and public."
            : "Preview — private, only people with this link can see it. Make it public in Settings to go live."}
        </div>
      )}

      {/* Accent glow — theme-agnostic, tinted by the user's accent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] max-w-full -translate-x-1/2 rounded-full bg-[var(--pa)] opacity-[0.12] blur-3xl"
      />

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <main className="relative mx-auto w-full max-w-2xl px-5 py-16 sm:py-24">
        {/* Identity */}
        <header className="flex flex-col items-center text-center">
          <div className="rounded-full bg-[var(--pa)] p-[2.5px] shadow-lg shadow-[var(--pa)]/20">
            {profile.imageUrl ? (
              <img
                src={profile.imageUrl}
                alt={profile.name}
                className="size-24 rounded-full object-cover ring-2 ring-background"
              />
            ) : (
              <div className="flex size-24 items-center justify-center rounded-full bg-muted text-3xl font-bold text-muted-foreground ring-2 ring-background">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-tight">
            {profile.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            <span className="font-semibold text-[var(--pa)]">
              @{profile.username}
            </span>
            <span className="text-muted-foreground/30">·</span>
            <span>Since {formatDate(profile.joinedAt)}</span>
            {lastPublished > 0 && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span>Last published {relativeTime(lastPublished)}</span>
              </>
            )}
          </div>

          {profile.bio && (
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-foreground/80">
              {profile.bio}
            </p>
          )}

          {/* Actions — copy link is front-and-center */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90",
                copied && "opacity-90",
              )}
              style={{ backgroundColor: copied ? "#10b981" : "var(--pa)" }}
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Link2 className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy link"}
            </button>

            {profile.feedUrl && (
              <a
                href={profile.feedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--pa)] px-3.5 py-1.5 text-xs font-semibold text-[var(--pa)] transition-colors hover:bg-[var(--pa)]/10"
              >
                <Rss className="size-3.5" />
                Follow
              </a>
            )}

            {profile.sites.map((site) => (
              <a
                key={site.url}
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[var(--pa)] hover:text-foreground"
              >
                <Globe className="size-3.5" />
                {profile.sites.length === 1 ? "Visit site" : site.name}
              </a>
            ))}

            {profile.socialLinks.map((link) => {
              const Icon = iconForUrl(link.url);
              return (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[var(--pa)] hover:text-foreground"
                >
                  <Icon className="size-3.5" />
                  {link.label}
                </a>
              );
            })}
          </div>

          {/* Topics */}
          {profile.topics.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
                Writes about
              </span>
              {profile.topics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Stats + heatmap */}
        {profile.stats && (
          <section className="mt-12">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                icon={PenLine}
                label="Published"
                value={profile.stats.totalPublished}
              />
              <StatTile
                icon={Type}
                label="Words"
                value={profile.stats.totalWords}
              />
              <StatTile
                icon={Flame}
                label="Streak"
                value={profile.stats.currentStreak}
                suffix="d"
                hot={profile.stats.currentStreak > 0}
              />
              <StatTile
                icon={Sparkles}
                label="Best streak"
                value={profile.stats.longestStreak}
                suffix="d"
              />
            </div>
            {profile.heatmap && profile.heatmap.length > 0 && (
              <div className="mt-4 rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
                <ActivityHeatmap data={profile.heatmap} />
              </div>
            )}
          </section>
        )}

        {/* Featured */}
        {profile.featured && (
          <section className="mt-12">
            <a
              href={profile.featured.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-2xl border border-[var(--pa)]/40 bg-[var(--pa)]/[0.04] p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--pa)] hover:shadow-lg hover:shadow-[var(--pa)]/10"
            >
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                style={{ backgroundColor: "var(--pa)" }}
              >
                <Sparkles className="size-2.5" />
                Featured
              </span>
              <p className="mt-2 text-lg font-semibold leading-snug transition-colors group-hover:text-[var(--pa)]">
                {profile.featured.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {profile.featured.projectName} ·{" "}
                {formatDate(profile.featured.publishedAt)}
              </p>
            </a>
          </section>
        )}

        {/* Posts */}
        <section className="mt-12">
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            <span className="h-px flex-1 bg-border/60" />
            Published writing
            <span className="h-px flex-1 bg-border/60" />
          </h2>
          {profile.posts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/60 px-4 py-12 text-center text-sm text-muted-foreground">
              {profile.featured
                ? "Nothing else published yet."
                : "No published posts yet."}
            </p>
          ) : (
            <ul className="space-y-2">
              {profile.posts.map((post) => (
                <li key={post.url}>
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/40 px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-[var(--pa)] hover:bg-card/70 hover:shadow-md hover:shadow-[var(--pa)]/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-[var(--pa)]">
                        {post.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground/70">
                        {post.projectName} · {formatDate(post.publishedAt)}
                      </p>
                    </div>
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-[var(--pa)]" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-16 text-center">
          <a
            href="https://wryte.xyz"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50 transition-colors hover:text-[var(--pa)]"
          >
            <PenLine className="size-3" />
            Published with Wryte
          </a>
        </footer>
      </main>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  suffix,
  hot,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  suffix?: string;
  hot?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-card/60 to-card/20 px-3 py-4 text-center backdrop-blur-sm">
      <Icon
        className={cn("mx-auto mb-1.5 size-4", hot && "text-orange-500")}
        style={hot ? undefined : { color: "var(--pa)" }}
      />
      <p className="text-xl font-bold tabular-nums">
        {value.toLocaleString()}
        {suffix && (
          <span className="ml-0.5 text-sm font-bold text-foreground/70">
            {suffix}
          </span>
        )}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/50">
        {label}
      </p>
    </div>
  );
}
