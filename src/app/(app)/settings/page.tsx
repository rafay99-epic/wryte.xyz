"use client";

import { useUser } from "@clerk/nextjs";
import { useHotkeyRecorder } from "@tanstack/react-hotkeys";
import { useAction, useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Command,
  ExternalLink,
  Eye,
  EyeOff,
  GitFork,
  ImageIcon,
  Keyboard,
  Loader2,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Shield,
  Skull,
  Sun,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CompressionSettingsForm } from "@/components/settings/compression-settings-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useGithubToken } from "@/hooks/use-github";
import {
  type CompressionSettings,
  compressionSettingsEqual,
  DEFAULT_COMPRESSION_SETTINGS,
} from "@/lib/image-compression";
import {
  fadeSlideUp,
  smoothTransition,
  staggerContainer,
  staggerItem,
} from "@/lib/motion";
import { splitShortcutKeys } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import {
  DEFAULT_SHORTCUTS,
  findConflict,
  type ShortcutCategory,
  useShortcutsStore,
} from "@/stores/shortcuts-store";
import { useThemeStore } from "@/stores/theme-store";
import { api } from "../../../../convex/_generated/api";

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */

type SettingsTab =
  | "account"
  | "appearance"
  | "media"
  | "shortcuts"
  | "self-destruct";

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "shortcuts", label: "Shortcuts", icon: Command },
  { id: "self-destruct", label: "Self-Destruct", icon: Skull },
];

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const convexUser = useQuery(api.users.get);
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  // Handle hash navigation (e.g. /settings#shortcuts)
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as SettingsTab;
    if (hash && TABS.some((t) => t.id === hash)) {
      setActiveTab(hash);
    }
  }, []);

  // Clear active project so sidebar shows default view
  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(null);
  }, []);

  if (!clerkLoaded || convexUser === undefined) {
    return <SettingsSkeleton />;
  }

  return (
    <motion.div
      variants={fadeSlideUp}
      initial="initial"
      animate="animate"
      transition={smoothTransition}
      className="flex h-full"
    >
      {/* Sidebar tabs */}
      <div className="w-56 shrink-0 border-r border-border/40 bg-muted/20 p-4 pt-6">
        <h1 className="mb-1 px-3 text-lg font-semibold tracking-tight">
          Settings
        </h1>
        <p className="mb-5 px-3 text-[11px] text-muted-foreground/60">
          Preferences & configuration
        </p>

        <nav className="space-y-0.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="settingsTabIndicator"
                    className="absolute inset-0 rounded-lg bg-background shadow-sm -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto slim-scrollbar">
        <div className="mx-auto max-w-xl px-8 py-8">
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "account" && (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <AccountTab
                  name={clerkUser?.fullName ?? convexUser?.name ?? "User"}
                  email={
                    clerkUser?.primaryEmailAddress?.emailAddress ??
                    convexUser?.email ??
                    ""
                  }
                  imageUrl={clerkUser?.imageUrl ?? convexUser?.imageUrl}
                  githubUsername={convexUser?.githubUsername}
                  existingToken={convexUser?.githubAccessToken ?? ""}
                />
              </motion.div>
            )}
            {activeTab === "appearance" && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <AppearanceTab />
              </motion.div>
            )}
            {activeTab === "media" && (
              <motion.div
                key="media"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <MediaTab
                  current={convexUser?.defaultCompressionSettings ?? null}
                />
              </motion.div>
            )}
            {activeTab === "shortcuts" && (
              <motion.div
                key="shortcuts"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <ShortcutsTab />
              </motion.div>
            )}
            {activeTab === "self-destruct" && (
              <motion.div
                key="self-destruct"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <SelfDestructTab />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section header helper                                              */
/* ------------------------------------------------------------------ */

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

/** Thin separator between content blocks */
function Divider() {
  return <div className="my-6 h-px bg-border/40" />;
}

/* ------------------------------------------------------------------ */
/*  Account Tab                                                        */
/* ------------------------------------------------------------------ */

function AccountTab({
  name,
  email,
  imageUrl,
  githubUsername,
  existingToken,
}: {
  name: string;
  email: string;
  imageUrl: string | undefined;
  githubUsername: string | undefined;
  existingToken: string;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={User}
        title="Account"
        description="Your profile and connected services"
      />

      {/* Profile card */}
      <motion.div variants={staggerItem} transition={smoothTransition}>
        <div className="flex items-center gap-4 rounded-xl border border-border/40 bg-card p-5">
          <Avatar className="size-14 ring-2 ring-border/30 ring-offset-2 ring-offset-background">
            <AvatarImage src={imageUrl} alt={name} />
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">{name}</p>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            <Shield className="mr-1 size-3" />
            Managed
          </Badge>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground/50">
          Profile details are managed by your authentication provider.
        </p>
      </motion.div>

      <Divider />

      {/* GitHub connection */}
      <motion.div variants={staggerItem} transition={smoothTransition}>
        <GitHubConnection githubUsername={githubUsername} />
      </motion.div>

      <Divider />

      {/* GitHub token fallback */}
      <motion.div variants={staggerItem} transition={smoothTransition}>
        <GitHubTokenInput existingToken={existingToken} />
      </motion.div>
    </motion.div>
  );
}

function GitHubConnection({
  githubUsername,
}: {
  githubUsername: string | undefined;
}) {
  const { isLoading: isChecking, isSuccess: oauthConnected } = useGithubToken();

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <GitFork className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">GitHub Connection</span>
      </div>

      <div
        className={cn(
          "rounded-xl border p-4 transition-colors",
          oauthConnected
            ? "border-emerald-500/20 bg-emerald-500/5"
            : "border-border/40 bg-card",
        )}
      >
        {isChecking ? (
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">
              Checking connection...
            </span>
          </div>
        ) : oauthConnected ? (
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="size-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Connected via OAuth
              </p>
              {githubUsername && (
                <p className="text-xs text-muted-foreground">
                  @{githubUsername}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <XCircle className="size-4 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium">Not connected</p>
              <p className="text-xs text-muted-foreground">
                Sign in with GitHub through Clerk to auto-import repos.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GitHubTokenInput({ existingToken }: { existingToken: string }) {
  const updateGithubToken = useAction(api.users.updateGithubToken);
  const [token, setToken] = useState(existingToken);
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setToken(existingToken);
  }, [existingToken]);

  const handleSave = useCallback(async () => {
    if (!token.trim()) {
      toast.error("Token is required");
      return;
    }
    setIsSaving(true);
    try {
      await updateGithubToken({ token: token.trim() });
      toast.success("GitHub token saved");
    } catch {
      toast.error("Failed to save token");
    } finally {
      setIsSaving(false);
    }
  }, [token, updateGithubToken]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Shield className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Personal Access Token</span>
        <Badge variant="outline" className="text-[9px]">
          Fallback
        </Badge>
      </div>

      <div className="space-y-3 rounded-xl border border-border/40 bg-card p-4">
        <div>
          <Label
            htmlFor="gh-token"
            className="mb-1.5 text-xs text-muted-foreground"
          >
            Token
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="gh-token"
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-foreground"
              >
                {showToken ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="shrink-0"
            >
              {isSaving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground/60">
          Requires{" "}
          <code className="rounded bg-muted px-1 py-px text-[10px]">repo</code>{" "}
          scope.{" "}
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Create token
            <ExternalLink className="size-2.5" />
          </a>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Appearance Tab                                                     */
/* ------------------------------------------------------------------ */

function AppearanceTab() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const themes = [
    {
      value: "light" as const,
      label: "Light",
      icon: Sun,
      preview: "bg-white border-zinc-200",
      previewAccent: "bg-zinc-100",
      previewText: "bg-zinc-300",
    },
    {
      value: "dark" as const,
      label: "Dark",
      icon: Moon,
      preview: "bg-zinc-900 border-zinc-700",
      previewAccent: "bg-zinc-800",
      previewText: "bg-zinc-700",
    },
    {
      value: "system" as const,
      label: "System",
      icon: Monitor,
      preview: "bg-gradient-to-br from-white to-zinc-900 border-zinc-400",
      previewAccent: "bg-zinc-500/30",
      previewText: "bg-zinc-500/50",
    },
  ];

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={Palette}
        title="Appearance"
        description="Customize the look and feel of the application"
      />

      <motion.div variants={staggerItem} transition={smoothTransition}>
        <div className="mb-3 text-xs font-medium text-muted-foreground">
          Theme
        </div>
        <div className="grid grid-cols-3 gap-3">
          {themes.map((theme) => {
            const Icon = theme.icon;
            const isActive = mode === theme.value;
            return (
              <button
                key={theme.value}
                type="button"
                onClick={() => setMode(theme.value)}
                className={cn(
                  "group relative flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 transition-all duration-200",
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/40 bg-card hover:border-border hover:bg-muted/30",
                )}
              >
                {/* Mini preview */}
                <div
                  className={cn(
                    "flex h-16 w-full flex-col gap-1.5 rounded-lg border p-2 transition-transform duration-200 group-hover:scale-[1.02]",
                    theme.preview,
                  )}
                >
                  <div
                    className={cn(
                      "h-1.5 w-8 rounded-full",
                      theme.previewAccent,
                    )}
                  />
                  <div
                    className={cn(
                      "h-1.5 w-full rounded-full",
                      theme.previewText,
                    )}
                  />
                  <div
                    className={cn(
                      "h-1.5 w-3/4 rounded-full",
                      theme.previewText,
                    )}
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <Icon
                    className={cn(
                      "size-3.5 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {theme.label}
                  </span>
                </div>

                {/* Active indicator dot */}
                {isActive && (
                  <motion.div
                    layoutId="themeIndicator"
                    className="absolute -top-1 -right-1 size-3 rounded-full bg-primary ring-2 ring-background"
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Media Tab — account-wide default for image compression             */
/* ------------------------------------------------------------------ */

/**
 * Sets the account-wide default that every project inherits. Projects with
 * their own `compressionSettings` override these. Saving `null` clears the
 * record and falls back to the library's built-in defaults.
 */
function MediaTab({ current }: { current: CompressionSettings | null }) {
  const save = useMutation(api.users.updateDefaultCompressionSettings);

  const initial: CompressionSettings = useMemo(
    () => current ?? DEFAULT_COMPRESSION_SETTINGS,
    [current],
  );

  const [draft, setDraft] = useState<CompressionSettings>(initial);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const isDirty = !compressionSettingsEqual(draft, initial);
  const canRestoreDefaults =
    current !== null &&
    !compressionSettingsEqual(draft, DEFAULT_COMPRESSION_SETTINGS);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await save({ settings: draft });
      toast.success("Default compression saved");
    } catch {
      toast.error("Failed to save compression");
    } finally {
      setIsSaving(false);
    }
  }, [draft, save]);

  const handleRestoreLibraryDefaults = useCallback(async () => {
    setIsSaving(true);
    try {
      await save({ settings: null });
      setDraft(DEFAULT_COMPRESSION_SETTINGS);
      toast.success("Reverted to built-in defaults");
    } catch {
      toast.error("Failed to revert");
    } finally {
      setIsSaving(false);
    }
  }, [save]);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={ImageIcon}
        title="Image Compression"
        description="Default applied to uploads across every project"
      />

      <motion.div variants={staggerItem} transition={smoothTransition}>
        <CompressionSettingsForm value={draft} onChange={setDraft} />
      </motion.div>

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="mt-5 flex items-center justify-between gap-3"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRestoreLibraryDefaults}
          disabled={!canRestoreDefaults || isSaving}
          className="text-xs text-muted-foreground"
        >
          <RotateCcw className="size-3" />
          Restore built-in defaults
        </Button>

        <Button size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
          {isSaving && <Loader2 className="size-3.5 animate-spin" />}
          Save defaults
        </Button>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shortcuts Tab                                                      */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  general: "General",
  navigation: "Navigation",
  editor: "Editor",
};

const CATEGORY_ORDER: ShortcutCategory[] = ["general", "navigation", "editor"];

function ShortcutsTab() {
  const { bindings, getKeys, setBinding, resetBinding, resetAll } =
    useShortcutsStore();
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const recorder = useHotkeyRecorder({
    onRecord: (hotkey) => {
      if (!recordingId) return;
      const conflicting = findConflict(hotkey, recordingId);
      if (conflicting) {
        setConflict(
          `"${hotkey}" conflicts with "${conflicting.label}". Try a different combination.`,
        );
        return;
      }
      setBinding(recordingId, hotkey);
      setRecordingId(null);
      setConflict(null);
      toast.success("Shortcut updated");
    },
    onCancel: () => {
      setRecordingId(null);
      setConflict(null);
    },
  });

  const handleStartRecording = useCallback(
    (id: string) => {
      setRecordingId(id);
      setConflict(null);
      recorder.startRecording();
    },
    [recorder],
  );

  const handleCancelRecording = useCallback(() => {
    recorder.cancelRecording();
    setRecordingId(null);
    setConflict(null);
  }, [recorder]);

  const handleReset = useCallback(
    (id: string) => {
      resetBinding(id);
      toast.success("Shortcut reset to default");
    },
    [resetBinding],
  );

  const handleResetAll = useCallback(() => {
    resetAll();
    toast.success("All shortcuts reset to defaults");
  }, [resetAll]);

  const grouped = useMemo(() => {
    const groups = new Map<ShortcutCategory, typeof DEFAULT_SHORTCUTS>();
    for (const cat of CATEGORY_ORDER) {
      groups.set(
        cat,
        DEFAULT_SHORTCUTS.filter((s) => s.category === cat),
      );
    }
    return groups;
  }, []);

  const hasCustomBindings = Object.keys(bindings).length > 0;

  return (
    <motion.div
      ref={scrollRef}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <SectionHeader
        icon={Keyboard}
        title="Keyboard Shortcuts"
        description="Customize bindings to match your workflow"
      />

      {/* Conflict warning */}
      <AnimatePresence>
        {conflict && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{conflict}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-5">
        {CATEGORY_ORDER.map((category) => {
          const shortcuts = grouped.get(category);
          if (!shortcuts || shortcuts.length === 0) return null;

          return (
            <motion.div
              key={category}
              variants={staggerItem}
              transition={smoothTransition}
            >
              <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
                {CATEGORY_LABELS[category]}
              </p>
              <div className="overflow-hidden rounded-xl border border-border/40 bg-card">
                {shortcuts.map((shortcut, idx) => {
                  const currentKeys = getKeys(shortcut.id);
                  const isRecording = recordingId === shortcut.id;
                  const isCustomized = bindings[shortcut.id] !== undefined;
                  const keys = splitShortcutKeys(currentKeys);
                  const isLast = idx === shortcuts.length - 1;

                  return (
                    <div
                      key={shortcut.id}
                      className={cn(
                        "group flex items-center justify-between px-4 py-3 transition-colors",
                        isRecording && "bg-primary/5",
                        !isRecording && "hover:bg-muted/30",
                        !isLast && "border-b border-border/20",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium">
                            {shortcut.label}
                          </span>
                          {isCustomized && !isRecording && (
                            <span className="rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-medium text-primary">
                              modified
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                          {shortcut.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isRecording ? (
                          <div className="flex items-center gap-2">
                            <div className="flex min-w-[80px] items-center justify-center rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5">
                              {recorder.recordedHotkey ? (
                                <KbdGroup
                                  keys={splitShortcutKeys(
                                    recorder.recordedHotkey,
                                  )}
                                />
                              ) : (
                                <span className="animate-pulse text-[11px] font-medium text-primary">
                                  Press keys...
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={handleCancelRecording}
                              className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <XCircle className="size-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartRecording(shortcut.id)}
                              className="rounded-lg border border-transparent px-2 py-1.5 transition-all hover:border-border/60 hover:bg-muted/50"
                              title="Click to rebind"
                            >
                              <KbdGroup keys={keys} />
                            </button>
                            {isCustomized && (
                              <button
                                type="button"
                                onClick={() => handleReset(shortcut.id)}
                                title="Reset to default"
                                className="rounded-md p-1 text-muted-foreground/30 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                              >
                                <RotateCcw className="size-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Reset all */}
      {hasCustomBindings && (
        <motion.div
          variants={staggerItem}
          transition={smoothTransition}
          className="mt-6 flex justify-end"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetAll}
            className="gap-1.5 text-xs"
          >
            <RotateCcw className="size-3" />
            Reset all to defaults
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Self-Destruct Tab                                                  */
/* ------------------------------------------------------------------ */

/**
 * Account reset. Wipes every user-scoped Convex row, every WorkOS Vault
 * entry, every scheduled-publish workflow, every per-user localStorage key.
 * The Clerk account itself is left untouched, as are files in the user's
 * external provider accounts (UploadThing / Cloudinary / GitHub).
 *
 * Backed by `api.users` (via `api.selfDestruct.*`) actions defined in
 * `convex/selfDestruct.ts`.
 */
function SelfDestructTab() {
  const preview = useQuery(api.selfDestruct.selfDestructPreview);
  const selfDestruct = useAction(api.selfDestruct.selfDestruct);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [scheduledAck, setScheduledAck] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  // Reset dialog state whenever it closes.
  useEffect(() => {
    if (!dialogOpen) {
      setTyped("");
      setScheduledAck(false);
    }
  }, [dialogOpen]);

  const hasScheduled = (preview?.scheduled.length ?? 0) > 0;
  const typedOk = typed.trim().toLowerCase() === "delete";
  const canSubmit = typedOk && (!hasScheduled || scheduledAck) && !isWiping;

  const handleWipe = useCallback(async () => {
    setIsWiping(true);
    try {
      const result = await selfDestruct();

      // Clear every per-user browser key. Iterate localStorage instead of
      // hard-coding so any new `wryte:view:*` entries get caught too.
      try {
        const toRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (!k) continue;
          if (
            k === "wryte-theme" ||
            k === "wryte-shortcuts" ||
            k === "wryte:search" ||
            k.startsWith("wryte:view:")
          ) {
            toRemove.push(k);
          }
        }
        for (const k of toRemove) window.localStorage.removeItem(k);
      } catch {
        // localStorage may be disabled in private windows — best effort.
      }

      // Build a partial-success message if any vault entries failed to delete.
      const { vaultOrphaned, scheduledFailedToCancel } = result.summary;
      if (vaultOrphaned > 0 || scheduledFailedToCancel > 0) {
        toast.warning("Account reset (with warnings)", {
          description: [
            vaultOrphaned > 0
              ? `${vaultOrphaned} vault ${vaultOrphaned === 1 ? "entry was" : "entries were"} unreachable and will be cleaned up later.`
              : null,
            scheduledFailedToCancel > 0
              ? `${scheduledFailedToCancel} scheduled ${scheduledFailedToCancel === 1 ? "workflow" : "workflows"} couldn't be cancelled (likely already finished).`
              : null,
          ]
            .filter(Boolean)
            .join(" "),
        });
      } else {
        toast.success("Account reset.");
      }

      // Hard reload so every component re-mounts against the fresh state
      // (theme, shortcuts, search, view prefs all reset from defaults).
      window.location.href = "/projects";
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to reset account"),
      );
      setIsWiping(false);
    }
  }, [selfDestruct]);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={Skull}
        title="Self-Destruct"
        description="Wipe everything we store for you and start fresh"
      />

      {/* Banner */}
      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-destructive">
              This is permanent and not reversible.
            </p>
            <p className="text-muted-foreground">Running self-destruct will:</p>
            <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li>delete every project, document, and publish history;</li>
              <li>
                cancel every pending or processing scheduled publish — your
                drafts will <span className="font-medium">not</span> be sent;
              </li>
              <li>
                erase every uploaded image record (UploadThing / Cloudinary /
                GitHub files in your own accounts are left alone);
              </li>
              <li>
                remove every stored credential — UploadThing tokens, Cloudinary
                API keys, and your GitHub personal access token are deleted from
                the secret vault;
              </li>
              <li>
                clear your local appearance, shortcut, and search-history
                preferences;
              </li>
              <li>
                keep your Clerk account so you stay signed in — everything else
                is gone.
              </li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Inventory */}
      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="mb-6 rounded-xl border bg-card p-4"
      >
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          What's currently on your account
        </p>
        {preview === undefined ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : preview === null ? (
          <p className="text-sm text-muted-foreground">
            Sign in to see your inventory.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <InventoryStat label="Projects" value={preview.projectCount} />
              <InventoryStat label="Documents" value={preview.documentCount} />
              <InventoryStat label="Media files" value={preview.mediaCount} />
              <InventoryStat
                label="Credentials in vault"
                value={
                  preview.vaultCredentialCount +
                  (preview.hasGithubVault ? 1 : 0)
                }
              />
              <InventoryStat
                label="Error log rows"
                value={preview.mediaErrorCount}
              />
              <InventoryStat
                label="Scheduled posts"
                value={preview.scheduled.length}
                emphasize={preview.scheduled.length > 0}
              />
            </div>
            {preview.scheduled.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="mb-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                  Pending scheduled posts that will be cancelled:
                </p>
                <ul className="space-y-1 text-xs">
                  {preview.scheduled.slice(0, 10).map((s) => (
                    <li
                      key={s.documentId}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="truncate font-medium">
                        {s.documentTitle}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {new Date(s.scheduledAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </li>
                  ))}
                  {preview.scheduled.length > 10 && (
                    <li className="text-[10px] text-muted-foreground">
                      …and {preview.scheduled.length - 10} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Trigger */}
      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 p-4"
      >
        <div>
          <p className="text-sm font-medium">Reset everything</p>
          <p className="text-xs text-muted-foreground">
            You'll have to confirm by typing{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">
              delete
            </code>
            .
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDialogOpen(true)}
          disabled={preview === undefined}
        >
          <Trash2 className="size-3.5" />
          Delete everything
        </Button>
      </motion.div>

      {/* Confirmation dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Reset your account?
            </DialogTitle>
            <DialogDescription>
              This will erase everything we store for you. The Clerk account and
              the files in your external storage accounts are left alone.
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <p className="font-medium">About to wipe:</p>
              <p className="mt-1 text-muted-foreground">
                {preview.projectCount} project
                {preview.projectCount === 1 ? "" : "s"} ·{" "}
                {preview.documentCount} document
                {preview.documentCount === 1 ? "" : "s"} · {preview.mediaCount}{" "}
                media file
                {preview.mediaCount === 1 ? "" : "s"} ·{" "}
                {preview.vaultCredentialCount +
                  (preview.hasGithubVault ? 1 : 0)}{" "}
                vault entr
                {preview.vaultCredentialCount +
                  (preview.hasGithubVault ? 1 : 0) ===
                1
                  ? "y"
                  : "ies"}
              </p>
            </div>
          )}

          {hasScheduled && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <input
                type="checkbox"
                checked={scheduledAck}
                onChange={(e) => setScheduledAck(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-amber-500"
              />
              <span className="text-xs">
                I understand the{" "}
                <span className="font-medium">
                  {preview?.scheduled.length} pending scheduled post
                  {preview?.scheduled.length === 1 ? "" : "s"}
                </span>{" "}
                listed above will be cancelled and never published.
              </span>
            </label>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="self-destruct-confirm" className="text-xs">
              Type{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
                delete
              </code>{" "}
              to confirm
            </Label>
            <Input
              id="self-destruct-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="delete"
              autoComplete="off"
              spellCheck={false}
              disabled={isWiping}
              className="font-mono text-sm"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isWiping}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleWipe}
              disabled={!canSubmit}
            >
              {isWiping ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Wiping account…
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  Delete everything
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function InventoryStat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card/60 p-2.5",
        emphasize && "border-amber-500/30 bg-amber-500/5",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          emphasize && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SettingsSkeleton() {
  return (
    <div className="flex h-full">
      <div className="w-56 shrink-0 border-r border-border/40 bg-muted/20 p-4 pt-6">
        <Skeleton className="mb-1 ml-3 h-6 w-20" />
        <Skeleton className="mb-5 ml-3 h-3 w-28" />
        <div className="space-y-1">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </div>
      <div className="flex-1 p-8">
        <div className="mx-auto max-w-xl space-y-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
