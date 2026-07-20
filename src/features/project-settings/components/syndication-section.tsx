"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Rss,
  Send,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { ConfirmActionDialog } from "@/components/settings/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  ALL_SYNDICATION_PROVIDERS,
  type SyndicationProvider,
  type SyndicationProviderEntry,
} from "../../../../convex/syndication/_lib/providers";
import {
  type SyndicationRow,
  useSyndicationSection,
} from "../hooks/use-syndication-section";
import type { ProjectData } from "../types";
import { Divider, FieldGroup, SaveButton, SectionHeader } from "./shared";

export function SyndicationSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const section = useSyndicationSection({ projectId });
  const [confirmDelete, setConfirmDelete] =
    useState<SyndicationProvider | null>(null);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={staggerItem}>
        <SectionHeader
          icon={Rss}
          title="Syndication"
          description="Cross-post published articles to dev.to and Hashnode with a canonical link back to your site."
        />
      </motion.div>

      {!project.siteUrl && (
        <motion.div variants={staggerItem}>
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Set your <strong>Site URL</strong> in General settings first —
              cross-posts carry a canonical link back to your site and will fail
              without it.
            </p>
          </div>
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="flex items-center">
              <p className="text-sm font-medium">Syndicate on publish</p>
              <InfoHint>
                When enabled, every publish to GitHub also mirrors the article
                to the platforms activated below. Your repo stays the source of
                truth: cross-posts carry a{" "}
                <code className="font-mono text-[10px]">rel=canonical</code>{" "}
                link to your site, and re-publishing updates the existing remote
                article instead of duplicating it. Unpublishing in Wryte never
                deletes remote posts. Medium isn't supported — its write API was
                discontinued; use Medium's own import-by-URL tool if needed.
              </InfoHint>
            </span>
            <p className="text-xs text-muted-foreground">
              Also cross-post whenever an article is published to GitHub. Off by
              default.
            </p>
          </div>
          <Switch
            checked={project.syndicateOnPublish ?? false}
            onCheckedChange={(checked) =>
              void section.toggleSyndicateOnPublish(checked)
            }
          />
        </div>

        <Divider />

        {ALL_SYNDICATION_PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            row={section.byProvider[provider.id]}
            section={section}
            onRemove={() => setConfirmDelete(provider.id)}
          />
        ))}
      </motion.div>

      <ConfirmActionDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title="Remove credentials?"
        description="Cross-posting to this platform stops until you connect a new token. Already-published cross-posts stay live."
        onConfirm={() => {
          if (confirmDelete) void section.handleDelete(confirmDelete);
        }}
      />
    </motion.div>
  );
}

function ProviderCard({
  provider,
  row,
  section,
  onRemove,
}: {
  provider: SyndicationProviderEntry;
  row: SyndicationRow | undefined;
  section: ReturnType<typeof useSyndicationSection>;
  onRemove: () => void;
}) {
  const { id } = provider;
  const hasExisting = row !== undefined;
  const token = section.tokens[id];
  const busyKind = section.busy?.provider === id ? section.busy.kind : null;
  const error = section.errors[id] ?? row?.lastVerifyError;

  return (
    <div className="space-y-4 rounded-lg border border-border/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{provider.label}</p>
          {provider.beta && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
              Beta
            </span>
          )}
          {provider.requiresPro && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
              Requires Hashnode Pro
            </span>
          )}
          {id === "hashnode" && (
            <InfoHint>
              <strong>Why Beta?</strong> Since May 2026 Hashnode's API is only
              available to publications on the paid Pro plan — requests from
              free publications are rejected before reaching the API. We have no
              Pro publication to test against, so publishing is built against
              Hashnode's published schema but hasn't been executed live. If your
              publication has Pro it should work; any error is recorded verbatim
              on the post's status row so it can be diagnosed exactly. A
              rejected connection here can mean either a bad token <em>or</em> a
              publication without Pro — the message tells you which.
            </InfoHint>
          )}
        </div>
        {hasExisting && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Active</span>
            <Switch
              checked={row.config.enabled}
              disabled={busyKind !== null || row.status !== "active"}
              onCheckedChange={(checked) =>
                void section.handleToggleEnabled(id, checked)
              }
            />
          </div>
        )}
      </div>

      <FieldGroup
        label={provider.keyHint}
        htmlFor={`syndication-token-${id}`}
        hint={`Create one at ${provider.dashboardUrl.replace("https://", "")}`}
      >
        <Input
          id={`syndication-token-${id}`}
          type="password"
          value={token}
          onChange={(e) => section.setToken(id, e.target.value)}
          placeholder={hasExisting ? "••••••••" : "Paste your token"}
        />
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {row ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                row.status === "active" && "bg-emerald-500/10 text-emerald-600",
                row.status === "invalid" && "bg-red-500/10 text-red-600",
                row.status === "verifying" && "bg-amber-500/10 text-amber-600",
                row.status === "rotating" && "bg-blue-500/10 text-blue-600",
              )}
            >
              {row.status === "active" ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <XCircle className="size-3" />
              )}
              {row.status === "active"
                ? row.config.enabled
                  ? "Connected · active"
                  : "Connected · inactive"
                : row.status.charAt(0).toUpperCase() + row.status.slice(1)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <XCircle className="size-3" />
              Not connected
            </span>
          )}
          {row?.config.username && (
            <span className="text-muted-foreground/50">
              @{row.config.username}
            </span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </FieldGroup>

      {id === "hashnode" &&
        row &&
        (row.config.publications?.length ?? 0) > 1 && (
          <FieldGroup
            label="Publication"
            hint="Cross-posts go to the selected publication."
          >
            <div className="flex flex-wrap gap-2">
              {row.config.publications?.map((pub) => (
                <button
                  key={pub.id}
                  type="button"
                  onClick={() => void section.handleSelectPublication(pub.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    row.config.publicationId === pub.id
                      ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {pub.url.replace(/^https?:\/\//, "")}
                </button>
              ))}
            </div>
          </FieldGroup>
        )}

      <div className="flex flex-wrap items-center gap-2">
        {!hasExisting ? (
          <SaveButton
            isSaving={busyKind === "save"}
            disabled={!token.trim()}
            onClick={() => void section.handleSave(id)}
            label="Save & Connect"
          />
        ) : (
          <>
            {token.trim() && (
              <SaveButton
                isSaving={busyKind === "save"}
                onClick={() => void section.handleSave(id)}
                label="Rotate Token"
              />
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={busyKind !== null}
              onClick={() => void section.handleTest(id)}
            >
              {busyKind === "test" && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              Test Connection
            </Button>
            {id === "devto" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busyKind !== null || row.status !== "active"}
                onClick={() => void section.handleSendTestPost()}
              >
                {busyKind === "testPost" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Send Test Post
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={busyKind !== null}
              onClick={onRemove}
              className="text-red-600 hover:text-red-700"
            >
              {busyKind === "delete" && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              Remove
            </Button>
          </>
        )}
      </div>

      {id === "devto" && (
        <p className="text-[11px] text-muted-foreground/60">
          Send Test Post pushes a sample <strong>draft</strong> to dev.to
          through the full pipeline — no commit to your repo, invisible in
          feeds. Delete it from your dev.to dashboard afterwards.
        </p>
      )}
      {id === "devto" && section.testPostUrl && (
        <a
          href={section.testPostUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
        >
          View the test draft on dev.to
          <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}
