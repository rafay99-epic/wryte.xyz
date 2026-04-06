"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Eye, EyeOff, GitFork, Loader2, Monitor, Moon, Sun, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useThemeStore } from "@/stores/theme-store";
import { api } from "../../../../convex/_generated/api";

export default function SettingsPage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const convexUser = useQuery(api.users.get);

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
          email={clerkUser?.primaryEmailAddress?.emailAddress ?? convexUser?.email ?? ""}
          imageUrl={clerkUser?.imageUrl ?? convexUser?.imageUrl}
        />
        <GitHubConnectionSection
          githubUsername={convexUser?.githubUsername}
        />
        <GitHubTokenSection
          existingToken={convexUser?.githubAccessToken ?? ""}
        />
        <ThemeSection />
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
  const [isChecking, setIsChecking] = useState(false);
  const [oauthConnected, setOauthConnected] = useState<boolean | null>(null);

  const checkOAuthConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      const res = await fetch("/api/github/token");
      setOauthConnected(res.ok);
    } catch {
      setOauthConnected(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkOAuthConnection();
  }, [checkOAuthConnection]);

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
