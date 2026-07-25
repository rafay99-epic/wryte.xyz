"use client";

import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  smoothTransition,
  staggerContainer,
  staggerItem,
} from "@wryte/logic/lib/motion";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@wryte/ui/popover";
import { Switch } from "@wryte/ui/switch";
import { Textarea } from "@wryte/ui/textarea";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  ExternalLink,
  Eye,
  Globe,
  Link2,
  Loader2,
  Pipette,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  ACCENT_KEYS,
  accentHex,
  isCustomAccent,
  PROFILE_ACCENTS,
} from "@/features/profile/accents";
import { MAX_BIO, MAX_LINKS, useProfileTab } from "../hooks/use-profile-tab";
import { Divider, SectionHeader } from "./shared";

export function ProfileTab() {
  const {
    profile,
    isSyncing,
    handleSync,
    bio,
    setBio,
    isBioDirty,
    isSavingBio,
    handleSaveBio,
    links,
    isLinksDirty,
    isSavingLinks,
    handleSaveLinks,
    addLink,
    removeLink,
    updateLink,
    handleTogglePublic,
    handleToggleStats,
    handleOpenPreview,
    handleCopyPreview,
    handleSetAccent,
    posts,
    handleSetFeatured,
    feedUrl,
    setFeedUrl,
    isFeedDirty,
    isSavingFeed,
    handleSaveFeed,
  } = useProfileTab();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [postQuery, setPostQuery] = useState("");

  if (profile === undefined) {
    return (
      <SectionHeader
        icon={Globe}
        title="Profile"
        description="Manage your public writing profile"
      />
    );
  }

  const username = profile?.username ?? null;
  const remaining = MAX_BIO - bio.length;

  const currentAccentHex = accentHex(profile?.profileAccent);
  const accentIsCustom = isCustomAccent(profile?.profileAccent);

  const currentFeatured =
    posts?.find((p) => p.id === profile?.featuredDocumentId) ?? null;
  const filteredPosts = (posts ?? [])
    .filter((p) =>
      p.title.toLowerCase().includes(postQuery.trim().toLowerCase()),
    )
    .slice(0, 50);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={Globe}
        title="Profile"
        description="Manage your public writing profile"
      />

      <motion.div variants={staggerItem} transition={smoothTransition}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Public URL</p>
            {username ? (
              <p className="truncate text-sm text-muted-foreground">
                wryte.xyz/@{username}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No username set yet
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleSync()}
            disabled={isSyncing}
            className="shrink-0"
          >
            {isSyncing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Refresh
          </Button>
        </div>

        {!username && (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Set a username in your Clerk account to get a public profile URL,
              then hit Refresh.
            </p>
          </div>
        )}
      </motion.div>

      <Divider />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Make profile public</p>
            <p className="text-xs text-muted-foreground">
              Anyone with the link can view your published posts
            </p>
          </div>
          <Switch
            checked={profile?.profilePublic ?? false}
            disabled={!username}
            onCheckedChange={(checked) => void handleTogglePublic(checked)}
          />
        </div>

        {profile?.profilePublic && username && (
          <a
            href={`/@${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
          >
            Your profile is live at /@{username}
            <ExternalLink className="size-3" />
          </a>
        )}

        {username && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="text-sm font-medium">Preview</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {profile?.profilePublic
                ? "See your live profile, or share the private link."
                : "Your profile is hidden from everyone. Preview it yourself, or share this link to show it before you go public."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleOpenPreview()}
              >
                <Eye className="size-3.5" />
                Open preview
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleCopyPreview()}
              >
                <Link2 className="size-3.5" />
                Copy preview link
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Show writing stats</p>
            <p className="text-xs text-muted-foreground">
              Show your streak and writing heatmap on your public profile
            </p>
          </div>
          <Switch
            checked={profile?.profileShowStats ?? false}
            onCheckedChange={(checked) => void handleToggleStats(checked)}
          />
        </div>
      </motion.div>

      <Divider />

      <motion.div variants={staggerItem} transition={smoothTransition}>
        <p className="mb-1.5 text-sm font-medium">Bio</p>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
          maxLength={MAX_BIO}
          rows={3}
          placeholder="A short line about you and what you write."
        />
        <div className="mt-1.5 flex items-center justify-between">
          <span
            className={cn(
              "text-[11px] tabular-nums",
              remaining < 20 ? "text-amber-500" : "text-muted-foreground/50",
            )}
          >
            {remaining} left
          </span>
          <Button
            size="sm"
            onClick={() => void handleSaveBio()}
            disabled={!isBioDirty || isSavingBio}
          >
            {isSavingBio && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      </motion.div>

      <Divider />

      <motion.div variants={staggerItem} transition={smoothTransition}>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-sm font-medium">Social links</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={addLink}
            disabled={links.length >= MAX_LINKS}
            className="text-xs text-muted-foreground"
          >
            <Plus className="size-3.5" />
            Add link
          </Button>
        </div>

        <div className="space-y-2">
          {links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={link.label}
                onChange={(e) => updateLink(i, { label: e.target.value })}
                placeholder="Label (e.g. Twitter)"
                className="w-32 shrink-0"
              />
              <Input
                value={link.url}
                onChange={(e) => updateLink(i, { url: e.target.value })}
                placeholder="https://..."
                className="flex-1"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeLink(i)}
                className="shrink-0 text-muted-foreground hover:text-red-600"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground/60">
            Links must start with https:// — up to {MAX_LINKS}.
          </p>
          <Button
            size="sm"
            onClick={() => void handleSaveLinks()}
            disabled={!isLinksDirty || isSavingLinks}
          >
            {isSavingLinks && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      </motion.div>

      <Divider />

      <motion.div variants={staggerItem} transition={smoothTransition}>
        <p className="mb-1.5 text-sm font-medium">Accent color</p>
        <div className="flex flex-wrap items-center gap-2">
          {ACCENT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => void handleSetAccent(key)}
              style={{ backgroundColor: PROFILE_ACCENTS[key] }}
              className={cn(
                "size-7 shrink-0 rounded-full transition-shadow",
                profile?.profileAccent === key &&
                  "ring-2 ring-foreground/40 ring-offset-2 ring-offset-background",
              )}
              aria-label={`Use ${key} accent`}
            />
          ))}

          {/* Custom color — native OS wheel, styled as a swatch. */}
          <label
            className={cn(
              "relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-shadow",
              accentIsCustom &&
                "ring-2 ring-foreground/40 ring-offset-2 ring-offset-background",
            )}
            style={
              accentIsCustom
                ? { backgroundColor: currentAccentHex }
                : {
                    background:
                      "conic-gradient(from 0deg, #f43f5e, #f59e0b, #22c55e, #14b8a6, #3b82f6, #8b5cf6, #f43f5e)",
                  }
            }
            aria-label="Custom accent color"
          >
            <Pipette
              className={cn(
                "size-3",
                accentIsCustom ? "text-white/90" : "text-black/60",
              )}
            />
            <input
              type="color"
              value={currentAccentHex}
              onChange={(e) => void handleSetAccent(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Pick a custom accent color"
            />
          </label>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground/60">
          Pick a preset or open the wheel for any custom color.
        </p>
      </motion.div>

      <Divider />

      <motion.div variants={staggerItem} transition={smoothTransition}>
        <p className="mb-1.5 text-sm font-medium">Featured post</p>
        {posts && posts.length > 0 ? (
          <div className="flex items-center gap-2">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className="w-full justify-between font-normal"
                  />
                }
              >
                <span className="truncate">
                  {currentFeatured?.title ?? "None — pick a post to pin"}
                </span>
                <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-(--anchor-width) p-0">
                <div className="flex items-center gap-2 border-b border-border/60 px-3">
                  <Search className="size-3.5 shrink-0 text-muted-foreground/60" />
                  <input
                    value={postQuery}
                    onChange={(e) => setPostQuery(e.target.value)}
                    placeholder="Search your posts…"
                    className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  <PickerRow
                    label="None"
                    selected={!profile?.featuredDocumentId}
                    onSelect={() => {
                      void handleSetFeatured(null);
                      setPickerOpen(false);
                    }}
                  />
                  {filteredPosts.map((post) => (
                    <PickerRow
                      key={post.id}
                      label={post.title}
                      selected={profile?.featuredDocumentId === post.id}
                      onSelect={() => {
                        void handleSetFeatured(post.id as Id<"documents">);
                        setPickerOpen(false);
                      }}
                    />
                  ))}
                  {filteredPosts.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      No posts match “{postQuery}”.
                    </p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {currentFeatured && (
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-red-600"
                onClick={() => void handleSetFeatured(null)}
                aria-label="Clear featured post"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Publish a post first to feature one.
          </p>
        )}
        <p className="mt-1.5 text-[11px] text-muted-foreground/60">
          Pinned to the top of your profile. Search by title.
        </p>
      </motion.div>

      <Divider />

      <motion.div variants={staggerItem} transition={smoothTransition}>
        <p className="mb-1.5 text-sm font-medium">Feed / follow URL</p>
        <Input
          value={feedUrl}
          onChange={(e) => setFeedUrl(e.target.value)}
          placeholder="https://yoursite.com/rss.xml"
        />
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground/60">
            A &quot;Follow&quot; button links here — your RSS or newsletter
            signup.
          </p>
          <Button
            size="sm"
            onClick={() => void handleSaveFeed()}
            disabled={!isFeedDirty || isSavingFeed}
          >
            {isSavingFeed && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PickerRow({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60",
        selected && "bg-muted/40 font-medium",
      )}
    >
      <span className="truncate">{label}</span>
      {selected && <Check className="size-3.5 shrink-0 text-primary" />}
    </button>
  );
}
