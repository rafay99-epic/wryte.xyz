"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Send,
  Share2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { buildPublishedUrl, defaultPostUrlPrefix } from "@/lib/social-template";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useSocialSection } from "../hooks/use-social-section";
import { bufferServiceLabel, type ProjectData } from "../types";
import { Divider, FieldGroup, SaveButton, SectionHeader } from "./shared";

export function SocialSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const {
    config,
    lastError,
    hasLegacyUploadPost,
    channels,
    apiKey,
    setApiKey,
    enabledChannels,
    postUrlPrefix,
    setPostUrlPrefix,
    busy,
    hasExisting,
    channelsChanged,
    prefixChanged,
    toggleAutoPost,
    toggleChannel,
    handleSave,
    handleSavePrefix,
    handleUpdateChannels,
    handleTest,
    handleTestPost,
    handleDelete,
    handleRemoveLegacy,
  } = useSocialSection({
    projectId,
    initialPostUrlPrefix: project.postUrlPrefix,
  });

  const urlPreview = project.siteUrl
    ? buildPublishedUrl({
        siteUrl: project.siteUrl,
        slug: "my-post",
        postUrlPrefix: postUrlPrefix.trim() || undefined,
        framework: project.framework,
      })
    : null;

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={staggerItem}>
        <SectionHeader
          icon={Share2}
          title="Social Media"
          description="Auto-announce new posts to your connected social channels via Buffer."
        />
      </motion.div>

      {!project.siteUrl && (
        <motion.div variants={staggerItem}>
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Set your <strong>Site URL</strong> in General settings first —
              it's used to build the blog post link in announcements.
            </p>
          </div>
        </motion.div>
      )}

      {hasLegacyUploadPost && !hasExisting && (
        <motion.div variants={staggerItem}>
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="text-xs text-amber-700 dark:text-amber-400">
              <p>
                <strong>Upload-Post has been replaced by Buffer.</strong>{" "}
                Announcements are paused for this project until you connect a
                Buffer API key below — your "post on publish" setting is
                unchanged.
              </p>
              <button
                type="button"
                onClick={() => void handleRemoveLegacy()}
                disabled={busy !== null}
                className="mt-1.5 font-medium underline underline-offset-2"
              >
                {busy === "legacy"
                  ? "Removing…"
                  : "Remove old Upload-Post credentials"}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Post on publish</p>
            <p className="text-xs text-muted-foreground">
              Automatically announce new posts when published to GitHub.
            </p>
          </div>
          <Switch
            checked={project.socialPostOnPublish ?? false}
            onCheckedChange={(checked) => void toggleAutoPost(checked)}
          />
        </div>

        <Divider />

        <p className="text-xs text-muted-foreground">
          Connect your social accounts in{" "}
          <a
            href="https://buffer.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Buffer
          </a>
          , create an API key at{" "}
          <a
            href="https://publish.buffer.com/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            publish.buffer.com/settings/api
          </a>
          , then paste it below.
        </p>

        {/* API Key */}
        <FieldGroup label="Buffer API Key" htmlFor="social-api-key">
          <div className="flex gap-2">
            <Input
              id="social-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasExisting ? "••••••••" : "Paste your API key"}
            />
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            {config != null ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  config.status === "active" &&
                    "bg-emerald-500/10 text-emerald-600",
                  config.status === "invalid" && "bg-red-500/10 text-red-600",
                  config.status === "verifying" &&
                    "bg-amber-500/10 text-amber-600",
                  config.status === "rotating" &&
                    "bg-blue-500/10 text-blue-600",
                )}
              >
                {config.status === "active" && (
                  <CheckCircle2 className="size-3" />
                )}
                {config.status === "invalid" && <XCircle className="size-3" />}
                {config.status === "verifying" && (
                  <Loader2 className="size-3 animate-spin" />
                )}
                {config.status === "active"
                  ? "Connected"
                  : config.status.charAt(0).toUpperCase() +
                    config.status.slice(1)}
              </span>
            ) : (
              // Explicit resting state — an empty form with no badge left
              // people unsure whether they were connected at all.
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <XCircle className="size-3" />
                Not connected
              </span>
            )}
            {config?.lastVerifiedAt && (
              <span className="text-muted-foreground/50">
                verified {new Date(config.lastVerifiedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          {(lastError ?? config?.lastVerifyError) && (
            <p className="mt-1 text-xs text-red-600">
              {lastError ?? config?.lastVerifyError}
            </p>
          )}
        </FieldGroup>

        {/* Connected channels — live from Buffer, refreshed by Test Connection */}
        {hasExisting && (
          <FieldGroup
            label="Channels"
            hint="Announcements go to the selected channels. Connect more in Buffer, then Test Connection to refresh this list."
          >
            {channels.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No channels found — connect your social accounts in Buffer, then
                run Test Connection.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {channels.map((channel) => {
                  const selected = enabledChannels.has(channel.id);
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => toggleChannel(channel.id)}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                        selected
                          ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                          : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      {bufferServiceLabel(channel.service)}
                      <span className="ml-1 opacity-60">{channel.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </FieldGroup>
        )}

        {/* Post URL prefix — where published posts live on the site */}
        <FieldGroup
          label="Post URL Path"
          htmlFor="social-url-prefix"
          hint={`Path between your site URL and the post slug. Empty uses the ${
            project.framework ?? "framework"
          } default ("${defaultPostUrlPrefix(project.framework)}").`}
        >
          <div className="flex items-center gap-2">
            <Input
              id="social-url-prefix"
              value={postUrlPrefix}
              onChange={(e) => setPostUrlPrefix(e.target.value)}
              placeholder={defaultPostUrlPrefix(project.framework)}
              className="max-w-[200px] font-mono text-sm"
            />
            {prefixChanged && (
              <SaveButton
                isSaving={false}
                onClick={() => void handleSavePrefix()}
                label="Save"
              />
            )}
          </div>
          {urlPreview && (
            <p className="mt-1 text-xs text-muted-foreground/70">
              Announcement links will look like{" "}
              <code className="rounded bg-muted px-1 py-px font-mono text-[10px]">
                {urlPreview}
              </code>
            </p>
          )}
        </FieldGroup>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!hasExisting ? (
            <SaveButton
              isSaving={busy === "save"}
              disabled={!apiKey.trim()}
              onClick={() => void handleSave()}
              label="Save & Connect"
            />
          ) : (
            <>
              {apiKey.trim() && (
                <SaveButton
                  isSaving={busy === "save"}
                  onClick={() => void handleSave()}
                  label="Rotate Key"
                />
              )}
              {channelsChanged && !apiKey.trim() && (
                <SaveButton
                  isSaving={busy === "config"}
                  onClick={() => void handleUpdateChannels()}
                  label="Update Channels"
                />
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void handleTest()}
              >
                {busy === "test" && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Test Connection
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null || config?.status !== "active"}
                onClick={() => void handleTestPost()}
              >
                {busy === "testPost" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Send Test Post
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void handleDelete()}
                className="text-red-600 hover:text-red-700"
              >
                {busy === "delete" && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Remove
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
