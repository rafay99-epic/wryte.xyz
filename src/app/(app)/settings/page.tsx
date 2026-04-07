"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useHotkeyRecorder } from "@tanstack/react-hotkeys";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  GitFork,
  Keyboard,
  Loader2,
  Monitor,
  Moon,
  RotateCcw,
  Sun,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useGithubToken } from "@/hooks/use-github";
import { splitShortcutKeys } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import {
  DEFAULT_SHORTCUTS,
  findConflict,
  useShortcutsStore,
  type ShortcutCategory,
} from "@/stores/shortcuts-store";
import { useThemeStore } from "@/stores/theme-store";
import { api } from "../../../../convex/_generated/api";

export default function SettingsPage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const convexUser = useQuery(api.users.get);

  // Clear active project so sidebar shows default view
  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(null);
  }, []);

  if (!clerkLoaded || convexUser === undefined) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and application preferences.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        <AccountSection
          name={clerkUser?.fullName ?? convexUser?.name ?? "User"}
          email={
            clerkUser?.primaryEmailAddress?.emailAddress ??
            convexUser?.email ??
            ""
          }
          imageUrl={clerkUser?.imageUrl ?? convexUser?.imageUrl}
        />
        <GitHubConnectionSection githubUsername={convexUser?.githubUsername} />
        <GitHubTokenSection
          existingToken={convexUser?.githubAccessToken ?? ""}
        />
        <ThemeSection />
        <KeyboardShortcutsSection />
      </div>
    </div>
  );
}

function AccountSection({
  name,
  email,
  imageUrl,
}: {
  name: string;
  email: string;
  imageUrl: string | undefined;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>
          Your account information from your authentication provider.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarImage src={imageUrl} alt={name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{name}</p>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Account details are managed through your authentication provider.
        </p>
      </CardContent>
    </Card>
  );
}

function GitHubConnectionSection({
  githubUsername,
}: {
  githubUsername: string | undefined;
}) {
  const { isLoading: isChecking, isSuccess: oauthConnected } = useGithubToken();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitFork className="size-5" />
          GitHub Connection
        </CardTitle>
        <CardDescription>
          Connect your GitHub account via OAuth to auto-import repositories and
          publish content. This is the recommended method.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border p-3">
          {isChecking ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Checking connection...
            </div>
          ) : oauthConnected ? (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-4" />
              GitHub connected via OAuth
              {githubUsername && (
                <span className="text-muted-foreground">
                  ({githubUsername})
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <XCircle className="size-4" />
              GitHub not connected via OAuth
            </div>
          )}
        </div>
        {!oauthConnected && !isChecking && (
          <p className="text-xs text-muted-foreground">
            To connect GitHub via OAuth, sign in with GitHub through Clerk or
            link your GitHub account in your Clerk profile. Once connected,
            Wryte will automatically access your repositories without needing a
            Personal Access Token.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function GitHubTokenSection({ existingToken }: { existingToken: string }) {
  const updateGithubToken = useMutation(api.users.updateGithubToken);

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
    <Card>
      <CardHeader>
        <CardTitle>GitHub Token (Fallback)</CardTitle>
        <CardDescription>
          If you haven&apos;t connected GitHub via OAuth above, you can use a
          Personal Access Token as a fallback for publishing content.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="global-gh-token">Personal Access Token</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="global-gh-token"
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              Save Token
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Requires the <code className="rounded bg-muted px-1">repo</code>{" "}
            scope. Create one at{" "}
            <a
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              github.com/settings/tokens
            </a>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ThemeSection() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const themes = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Choose how the application looks for you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {themes.map((theme) => {
            const Icon = theme.icon;
            const isActive = mode === theme.value;
            return (
              <Button
                key={theme.value}
                variant={isActive ? "secondary" : "outline"}
                size="sm"
                onClick={() => setMode(theme.value)}
              >
                <Icon className="size-4" />
                {theme.label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Keyboard Shortcuts Section
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  general: "General",
  navigation: "Navigation",
  editor: "Editor",
};

const CATEGORY_ORDER: ShortcutCategory[] = ["general", "navigation", "editor"];

function KeyboardShortcutsSection() {
  const { bindings, getKeys, setBinding, resetBinding, resetAll } =
    useShortcutsStore();
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const recorder = useHotkeyRecorder({
    onRecord: (hotkey) => {
      if (!recordingId) return;
      // Check for conflicts
      const conflicting = findConflict(hotkey, recordingId);
      if (conflicting) {
        setConflict(
          `"${hotkey}" is already used by "${conflicting.label}". Press another key or click Cancel.`,
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

  // Group shortcuts by category
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

  // Check if any bindings have been customized
  const hasCustomBindings = Object.keys(bindings).length > 0;

  return (
    <Card id="shortcuts">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Keyboard className="size-5" />
          Keyboard Shortcuts
        </CardTitle>
        <CardDescription>
          Customize keyboard shortcuts. Click a shortcut to change its binding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {CATEGORY_ORDER.map((category) => {
          const shortcuts = grouped.get(category);
          if (!shortcuts || shortcuts.length === 0) return null;

          return (
            <div key={category}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                {CATEGORY_LABELS[category]}
              </p>
              <div className="space-y-1">
                {shortcuts.map((shortcut) => {
                  const currentKeys = getKeys(shortcut.id);
                  const isRecording = recordingId === shortcut.id;
                  const isCustomized =
                    bindings[shortcut.id] !== undefined;
                  const keys = splitShortcutKeys(currentKeys);

                  return (
                    <div
                      key={shortcut.id}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2 transition-colors",
                        isRecording
                          ? "bg-primary/5 ring-1 ring-primary/30"
                          : "hover:bg-muted/40",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {shortcut.label}
                          </span>
                          {isCustomized && (
                            <Badge
                              variant="outline"
                              className="px-1 py-0 text-[9px]"
                            >
                              custom
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground/60">
                          {shortcut.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isRecording ? (
                          <div className="flex items-center gap-2">
                            {recorder.recordedHotkey ? (
                              <KbdGroup
                                keys={splitShortcutKeys(recorder.recordedHotkey)}
                              />
                            ) : (
                              <span className="animate-pulse text-xs text-primary">
                                Press keys...
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={handleCancelRecording}
                              className="text-muted-foreground"
                            >
                              <XCircle className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartRecording(shortcut.id)}
                              className="rounded-md px-1.5 py-1 transition-colors hover:bg-muted"
                            >
                              <KbdGroup keys={keys} />
                            </button>
                            {isCustomized && (
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleReset(shortcut.id)}
                                title="Reset to default"
                                className="text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground [div:hover>&]:opacity-100"
                              >
                                <RotateCcw className="size-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Conflict warning */}
        {conflict && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{conflict}</span>
          </div>
        )}

        {/* Reset all */}
        {hasCustomBindings && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetAll}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            Reset all to defaults
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Settings Skeleton
// ---------------------------------------------------------------------------

function SettingsSkeleton() {
  return (
    <div className="p-6">
      <Skeleton className="mb-2 h-8 w-32" />
      <Skeleton className="mb-6 h-4 w-48" />
      <div className="mx-auto max-w-2xl space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
