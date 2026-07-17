"use client";

import { motion } from "framer-motion";
import { Check, Copy, Rocket } from "lucide-react";
import { useState } from "react";
import { SaveBar } from "@/components/settings/save-bar";
import { InfoHint } from "@/components/ui/info-hint";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  attributionLine,
  DEFAULT_ATTRIBUTION_TEXT,
} from "../../../../convex/_lib/commitAttribution";
import { usePublishingSection } from "../hooks/use-publishing-section";
import type { ProjectData } from "../types";
import {
  FieldGroup,
  MediaModeOption,
  RowList,
  SectionHeader,
  SettingsGroup,
  ToggleRow,
} from "./shared";

/** README badge markdown — image served from /badge.svg, click measured via /gh. */
const BADGE_SNIPPET =
  "[![Published with Wryte](https://wryte.xyz/badge.svg)](https://wryte.xyz/gh?utm_medium=badge)";

/** Copy box for the README badge snippet (share-link dialog's copy pattern). */
function BadgeSnippet() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(BADGE_SNIPPET).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mt-3 border-t border-border/40 pt-3">
      <div className="mb-1.5 flex items-center gap-2">
        <p className="text-xs font-medium">README badge</p>
        <img src="/badge.svg" alt="Published with Wryte" height={20} />
        <InfoHint>
          Paste this markdown into your repo&apos;s README. The badge image is
          served from wryte.xyz and links back through the /gh vanity URL, so
          badge clicks show up in analytics separately from commit-link clicks.
        </InfoHint>
      </div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-border/40 bg-muted/40 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
          {BADGE_SNIPPET}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy badge markdown"
          className="flex shrink-0 items-center justify-center rounded-lg border border-border/40 p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-500" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

export function PublishingSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const {
    commitTemplate,
    setCommitTemplate,
    attributionEnabled,
    setAttributionEnabled,
    attributionText,
    setAttributionText,
    attributionError,
    verifiedCommits,
    setVerifiedCommits,
    defaultDraft,
    setDefaultDraft,
    frontmatterFormat,
    setFrontmatterFormat,
    timezone,
    setTimezone,
    autoSaveEnabled,
    setAutoSaveEnabled,
    trashRetentionDays,
    setTrashRetentionDays,
    isSaving,
    hasChanges,
    handleSave,
  } = usePublishingSection({ projectId, project });

  const retentionLabel =
    trashRetentionDays >= 36500 ? "forever" : `${trashRetentionDays}d trash`;

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={Rocket}
        title="Publishing"
        description="How content is committed and deployed"
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-3"
      >
        <SettingsGroup
          title="Commits"
          summary={commitTemplate || "docs: publish {{filename}}"}
          defaultOpen
        >
          <FieldGroup
            label="Commit message template"
            htmlFor="s-commit"
            hint="Default message for every publish."
            info={
              <>
                Used when you don&apos;t type a custom message in the publish
                dialog. Variables: <code>{"{{filename}}"}</code>,{" "}
                <code>{"{{title}}"}</code>, <code>{"{{slug}}"}</code>,{" "}
                <code>{"{{date}}"}</code>.
              </>
            }
          >
            <Input
              id="s-commit"
              value={commitTemplate}
              onChange={(e) => setCommitTemplate(e.target.value)}
              placeholder="docs: publish {{filename}}"
              className="font-mono text-sm"
            />
          </FieldGroup>

          <div className="py-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="flex items-center text-sm font-medium">
                  Wryte attribution
                  <InfoHint>
                    Appends{" "}
                    <code className="text-primary">
                      {attributionLine(attributionText)}
                    </code>{" "}
                    to publish commits. The publish dialog always previews the
                    exact line before you commit. Customize the phrase below —
                    the wryte.xyz/gh link is always appended. Variables:{" "}
                    <code>{"{{title}}"}</code>, <code>{"{{filename}}"}</code>.
                  </InfoHint>
                </p>
                <p className="text-xs text-muted-foreground">
                  Credit Wryte in commit messages.
                </p>
              </div>
              <Switch
                checked={attributionEnabled}
                onCheckedChange={(checked) => setAttributionEnabled(checked)}
              />
            </div>
            {attributionEnabled && (
              <div className="mt-3 space-y-1">
                <Input
                  value={attributionText}
                  onChange={(e) => setAttributionText(e.target.value)}
                  placeholder={DEFAULT_ATTRIBUTION_TEXT}
                  className="font-mono text-sm"
                  aria-label="Custom attribution text"
                />
                {attributionError && (
                  <p className="text-xs text-destructive">{attributionError}</p>
                )}
              </div>
            )}
            <BadgeSnippet />
          </div>

          <RowList>
            <ToggleRow
              title="Verified commits"
              line="Commit as wryte-xyz[bot] with a Verified badge."
              info={
                <>
                  Requires installing the{" "}
                  <a
                    href="https://github.com/apps/wryte-xyz/installations/new"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    wryte-xyz GitHub App
                  </a>{" "}
                  on your repo. Publishes are then committed by the bot with
                  GitHub&apos;s Verified badge while you remain the git author —
                  your avatar and contribution graph stay intact. Without the
                  App installed, publishing quietly falls back to your own
                  token.
                </>
              }
              checked={verifiedCommits}
              onCheckedChange={setVerifiedCommits}
            />
          </RowList>
        </SettingsGroup>

        <SettingsGroup
          title="Writing behavior"
          summary={`Draft ${defaultDraft ? "on" : "off"} · Auto-save ${autoSaveEnabled ? "on" : "off"}`}
        >
          <RowList>
            <ToggleRow
              title="Default to draft"
              line="New posts start as drafts."
              info={
                <>
                  New documents get <code>draft: true</code> in their
                  frontmatter, so your site skips them until you flip the flag
                  at publish time.
                </>
              }
              checked={defaultDraft}
              onCheckedChange={setDefaultDraft}
            />
            <ToggleRow
              title="Auto-save"
              line="Saves as you type."
              info={
                <>
                  Edits persist a few seconds after you stop typing. Turned off,
                  nothing saves until you press <kbd>⌘S</kbd> /{" "}
                  <kbd>Ctrl+S</kbd>.
                </>
              }
              checked={autoSaveEnabled}
              onCheckedChange={setAutoSaveEnabled}
            />
          </RowList>
        </SettingsGroup>

        <SettingsGroup
          title="Format & time"
          summary={`${frontmatterFormat.toUpperCase()} · ${timezone || "browser tz"} · ${retentionLabel}`}
        >
          <FieldGroup
            label="Frontmatter format"
            info={
              <>
                YAML frontmatter is delimited with <code>---</code> and is what
                most frameworks expect. TOML uses <code>+++</code> and is
                Hugo&apos;s default.
              </>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <MediaModeOption
                active={frontmatterFormat === "yaml"}
                onClick={() => setFrontmatterFormat("yaml")}
                title="YAML"
                description="--- delimiters"
              />
              <MediaModeOption
                active={frontmatterFormat === "toml"}
                onClick={() => setFrontmatterFormat("toml")}
                title="TOML"
                description="+++ (Hugo)"
              />
            </div>
          </FieldGroup>

          <FieldGroup
            label="Publishing timezone"
            htmlFor="s-timezone"
            hint="For scheduled publish times."
            info={
              <>
                Drives how scheduled publish times are interpreted and how the
                publish-date frontmatter field is rendered. Leave on browser
                default to use whatever timezone you happen to be in.
              </>
            }
          >
            <TimezoneSelect
              id="s-timezone"
              value={timezone}
              onChange={setTimezone}
            />
          </FieldGroup>

          <FieldGroup
            label="Trash retention"
            hint="Deleted posts stay restorable this long."
            info={
              <>
                How long deleted documents stay in this project&apos;s trash
                before being permanently removed. Restorable any time before
                then; &quot;Forever&quot; means only manual cleanup.
              </>
            }
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <MediaModeOption
                active={trashRetentionDays === 7}
                onClick={() => setTrashRetentionDays(7)}
                title="7 days"
                description="Quick cleanup"
              />
              <MediaModeOption
                active={trashRetentionDays === 30}
                onClick={() => setTrashRetentionDays(30)}
                title="30 days"
                description="Recommended"
              />
              <MediaModeOption
                active={trashRetentionDays === 90}
                onClick={() => setTrashRetentionDays(90)}
                title="90 days"
                description="Long memory"
              />
              <MediaModeOption
                active={trashRetentionDays >= 36500}
                onClick={() => setTrashRetentionDays(36500)}
                title="Forever"
                description="Manual only"
              />
            </div>
          </FieldGroup>
        </SettingsGroup>

        <SaveBar
          hasChanges={hasChanges}
          isSaving={isSaving}
          disabled={Boolean(attributionError)}
          onSave={() => void handleSave()}
        />
      </motion.div>
    </motion.div>
  );
}
