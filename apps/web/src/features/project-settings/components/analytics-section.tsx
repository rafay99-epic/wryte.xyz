"use client";

import type { Id } from "@wryte/backend/_generated/dataModel";
import { ALL_ANALYTICS_PROVIDERS } from "@wryte/backend/insights/_lib/providers";
import { staggerContainer, staggerItem } from "@wryte/logic/lib/motion";
import { relativeTime } from "@wryte/logic/lib/relative-time";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { Switch } from "@wryte/ui/switch";
import { motion } from "framer-motion";
import {
  BarChart3,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { ConfirmActionDialog } from "@/components/settings/confirm-action-dialog";
import { useAnalyticsSection } from "../hooks/use-analytics-section";
import type { ProjectData } from "../types";
import { FieldGroup, SaveButton, SectionHeader } from "./shared";

/** Numbered how-to per provider × mode — the education the flow leads with. */
const SHARE_STEPS: Record<string, string[]> = {
  umami: [
    "Open Umami → Settings → Websites → Edit your site.",
    'Turn on "Share URL" and copy the link.',
    "Paste it below and hit Connect.",
  ],
  plausible: [
    "Open Plausible → your site → Site settings → Visibility.",
    'Create a "Shared link" (no password) and copy it.',
    "Paste it below and hit Connect.",
  ],
};

const API_STEPS: Record<string, string[]> = {
  umami: [
    "Umami Cloud (paid plan) → Settings → API keys → Create key. Self-hosted: use a bearer token + your instance URL.",
    "Paste the key below — self-hosted users also fill the instance URL.",
    "Connect. Wryte matches traffic to each post automatically.",
  ],
  plausible: [
    "Plausible (paid plan) → account Settings → API keys → New (Stats API). Self-hosted CE works free — fill your instance URL.",
    "Paste the key below; the site domain defaults to your Site URL.",
    "Connect. Wryte matches traffic to each post automatically.",
  ],
};

export function AnalyticsSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const section = useAnalyticsSection({
    projectId,
    siteUrl: project.siteUrl,
  });
  const [confirmRemove, setConfirmRemove] = useState(false);
  /** Pre-connect: the master toggle just reveals the setup flow. */
  const [setupOpen, setSetupOpen] = useState(false);

  const target = section.target;
  const enabled = target ? target.enabled : setupOpen;

  const handleMasterToggle = (checked: boolean) => {
    if (target) void section.handleToggleEnabled(checked);
    else setSetupOpen(checked);
  };

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={staggerItem}>
        <SectionHeader
          icon={BarChart3}
          title="Analytics"
          description="See how your published posts perform, without leaving Wryte."
        />
      </motion.div>

      {/* Step 1 — the master switch. Everything else appears below it. */}
      <motion.div
        variants={staggerItem}
        className="flex items-center justify-between rounded-lg border border-border/60 p-4"
      >
        <div>
          <p className="text-sm font-medium">Enable analytics</p>
          <p className="text-xs text-muted-foreground">
            {target
              ? enabled
                ? "Analytics is live — find it in your project sidebar."
                : "Connection kept; turn back on to show the Analytics page again."
              : "Turn on to connect Plausible or Umami in two minutes."}
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={section.busy !== null}
          onCheckedChange={handleMasterToggle}
        />
      </motion.div>

      {/* Step 2 — connected summary, or the guided setup. */}
      {enabled && (
        <motion.div variants={staggerItem} className="mt-4">
          {target ? (
            <ConnectedCard
              section={section}
              onRemove={() => setConfirmRemove(true)}
            />
          ) : (
            <SetupFlow section={section} />
          )}
        </motion.div>
      )}

      <ConfirmActionDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Disconnect analytics?"
        description="The Analytics page and views column disappear until you connect again."
        onConfirm={() => void section.handleRemove()}
      />
    </motion.div>
  );
}

/* ── Guided setup ────────────────────────────────────────────────────── */

function SetupFlow({
  section,
}: {
  section: ReturnType<typeof useAnalyticsSection>;
}) {
  const steps =
    section.mode === "share"
      ? SHARE_STEPS[section.provider]
      : API_STEPS[section.provider];

  return (
    <div className="space-y-4 rounded-lg border border-border/60 p-4">
      <FieldGroup
        label="1 · Which provider tracks your site?"
        hint="The analytics tool already installed on your published site."
      >
        <div className="flex flex-wrap gap-2">
          {ALL_ANALYTICS_PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => section.setProvider(p.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                section.provider === p.id
                  ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup label="2 · How do you want to connect?">
        <div className="grid gap-2 sm:grid-cols-2">
          <ModeCard
            selected={section.mode === "share"}
            onSelect={() => section.setMode("share")}
            icon={Link2}
            title="Share link"
            badge="Free"
            badgeClass="bg-emerald-500/10 text-emerald-600"
            description="Shows your live analytics dashboard inside Wryte. Works on every plan — takes one copied link."
          />
          <ModeCard
            selected={section.mode === "api"}
            onSelect={() => section.setMode("api")}
            icon={KeyRound}
            title="API key"
            badge="Paid plan"
            badgeClass="bg-amber-500/10 text-amber-600"
            description="Adds per-post view counts to your content table. Needs the provider's paid tier (self-hosted is free)."
          />
        </div>
      </FieldGroup>

      <FieldGroup label="3 · Connect">
        <ol className="mb-3 space-y-1">
          {(steps ?? []).map((step, i) => (
            <li key={step} className="flex gap-2 text-xs text-muted-foreground">
              <span className="font-mono text-muted-foreground/50">
                {i + 1}.
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        {section.mode === "share" ? (
          <Input
            value={section.shareUrl}
            onChange={(e) => section.setShareUrl(e.target.value)}
            placeholder={
              section.provider === "umami"
                ? "https://cloud.umami.is/share/…"
                : "https://plausible.io/share/…"
            }
          />
        ) : (
          <div className="space-y-2">
            <Input
              type="password"
              value={section.token}
              onChange={(e) => section.setToken(e.target.value)}
              placeholder="API key"
            />
            <Input
              value={section.baseUrl}
              onChange={(e) => section.setBaseUrl(e.target.value)}
              placeholder="Self-hosted instance URL (blank = cloud)"
            />
            {section.provider === "plausible" && (
              <Input
                value={section.siteDomain}
                onChange={(e) => section.setSiteDomain(e.target.value)}
                placeholder={
                  section.hostnameHint
                    ? `Site domain (defaults to ${section.hostnameHint})`
                    : "Site domain, e.g. example.com"
                }
              />
            )}
          </div>
        )}

        {section.error && (
          <p className="mt-2 text-xs text-red-600">{section.error}</p>
        )}

        <div className="mt-3">
          <SaveButton
            isSaving={section.busy === "connect"}
            disabled={
              section.mode === "share"
                ? !section.shareUrl.trim()
                : !section.token.trim()
            }
            onClick={() =>
              void (section.mode === "share"
                ? section.handleConnectShare()
                : section.handleConnect())
            }
            label="Connect"
          />
        </div>
      </FieldGroup>
    </div>
  );
}

function ModeCard({
  selected,
  onSelect,
  icon: Icon,
  title,
  badge,
  badgeClass,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ElementType;
  title: string;
  badge: string;
  badgeClass: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
          : "border-border/60 hover:bg-muted/30",
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">{title}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            badgeClass,
          )}
        >
          {badge}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

/* ── Connected summary ───────────────────────────────────────────────── */

function ConnectedCard({
  section,
  onRemove,
}: {
  section: ReturnType<typeof useAnalyticsSection>;
  onRemove: () => void;
}) {
  const target = section.target;
  if (!target) return null;
  const label =
    ALL_ANALYTICS_PROVIDERS.find((p) => p.id === target.provider)?.label ??
    target.provider;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{label}</p>
          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {target.mode === "share" ? "Share link" : "API key"}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              target.status === "active"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-red-500/10 text-red-600",
            )}
          >
            {target.status === "active" ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <XCircle className="size-3" />
            )}
            {target.status === "active" ? "Connected" : "Invalid"}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={section.busy !== null}
          onClick={onRemove}
          className="text-red-600 hover:text-red-700"
        >
          {section.busy === "remove" && (
            <Loader2 className="size-3.5 animate-spin" />
          )}
          Remove
        </Button>
      </div>

      {target.mode === "share" ? (
        <>
          <p className="truncate text-xs text-muted-foreground">
            {target.shareUrl}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {target.embedBlocked ? (
              <>
                <ExternalLink className="size-3 shrink-0" />
                This share page doesn't allow embedding, so the Analytics page
                opens your dashboard in a new tab instead.
              </>
            ) : (
              "Your live dashboard shows on the Analytics page in the sidebar."
            )}
          </p>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Site{" "}
            <code className="rounded bg-muted px-1 py-px text-[10px]">
              {target.siteId}
            </code>
            {target.baseUrl ? ` · ${target.baseUrl}` : ""} · per-post views
            appear in your content table.
          </p>
          {target.status === "invalid" && target.lastError && (
            <p className="text-xs text-red-600">{target.lastError}</p>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {section.snapshot
                ? `${section.snapshot.totals.pageviews.toLocaleString()} pageviews · ${section.snapshot.totals.visitors.toLocaleString()} visitors (30d) · updated ${relativeTime(section.snapshot.fetchedAt)}`
                : target.enabled
                  ? "No data fetched yet."
                  : "Enable analytics to start fetching data."}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={section.busy !== null || !target.enabled}
              onClick={() => void section.handleRefresh()}
            >
              {section.busy === "refresh" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Refresh
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
