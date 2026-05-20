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
import { SocialPostField } from "@/components/forms/social-post-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useSocialSection } from "../hooks/use-social-section";
import { type ProjectData, UPLOAD_POST_PLATFORMS } from "../types";
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
    apiKey,
    setApiKey,
    username,
    setUsername,
    platforms,
    postTemplate,
    setPostTemplate,
    subreddit,
    setSubreddit,
    busy,
    hasExisting,
    configChanged,
    toggleAutoPost,
    togglePlatform,
    handleSave,
    handleUpdateConfig,
    handleTest,
    handleTestPost,
    handleDelete,
  } = useSocialSection({ projectId });

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={staggerItem}>
        <SectionHeader
          icon={Share2}
          title="Social Media"
          description="Auto-announce new posts to your connected social platforms via Upload-Post."
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
          Connect your social accounts at{" "}
          <a
            href="https://upload-post.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            upload-post.com
          </a>
          , then paste your API key below.
        </p>

        {/* API Key */}
        <FieldGroup label="API Key" htmlFor="social-api-key">
          <div className="flex gap-2">
            <Input
              id="social-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasExisting ? "••••••••" : "Paste your API key"}
            />
          </div>
          {config != null && (
            <div className="mt-1.5 flex items-center gap-2 text-xs">
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
                {config.status.charAt(0).toUpperCase() + config.status.slice(1)}
              </span>
              {config.lastVerifiedAt && (
                <span className="text-muted-foreground/50">
                  verified{" "}
                  {new Date(config.lastVerifiedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
          {config?.lastVerifyError && (
            <p className="mt-1 text-xs text-red-600">
              {config.lastVerifyError}
            </p>
          )}
        </FieldGroup>

        {/* Username */}
        <FieldGroup
          label="Upload-Post Username"
          htmlFor="social-username"
          hint="Your profile username on upload-post.com."
        >
          <Input
            id="social-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. johndoe"
          />
        </FieldGroup>

        {/* Platform selector */}
        <FieldGroup
          label="Platforms"
          hint="Select which platforms to announce to."
        >
          <div className="flex flex-wrap gap-2">
            {UPLOAD_POST_PLATFORMS.map((p) => {
              const selected = platforms.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    selected
                      ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </FieldGroup>

        {/* Subreddit (required when Reddit is selected) */}
        {platforms.has("reddit") && (
          <FieldGroup
            label="Subreddit"
            htmlFor="social-subreddit"
            hint="Required for Reddit. Just the name, e.g. webdev"
          >
            <Input
              id="social-subreddit"
              value={subreddit}
              onChange={(e) => setSubreddit(e.target.value)}
              placeholder="e.g. webdev"
              className="font-mono text-sm"
            />
            {/^r\/|\/$/i.test(subreddit) && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Just the name — no{" "}
                <code className="rounded bg-muted px-1 py-px text-[10px] font-mono">
                  r/
                </code>{" "}
                prefix or trailing slash. We'll add it automatically.
              </p>
            )}
          </FieldGroup>
        )}

        {/* Post template */}
        <FieldGroup label="Post Template" htmlFor="social-post-template">
          <SocialPostField
            id="social-post-template"
            value={postTemplate}
            onChange={setPostTemplate}
            placeholder={"New blog post: {{title}}\n\n{{url}}"}
          />
        </FieldGroup>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!hasExisting ? (
            <SaveButton
              isSaving={busy === "save"}
              disabled={
                !apiKey.trim() || !username.trim() || platforms.size === 0
              }
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
              {configChanged && !apiKey.trim() && (
                <SaveButton
                  isSaving={busy === "config"}
                  onClick={() => void handleUpdateConfig()}
                  label="Update Config"
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
