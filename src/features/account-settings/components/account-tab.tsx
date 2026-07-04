"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  GitFork,
  Loader2,
  Shield,
  User,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGithubToken } from "@/hooks/use-github";
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useGithubTokenInput } from "../hooks/use-github-token-input";
import { Divider, SectionHeader } from "./shared";

type AccountTabProps = {
  name: string;
  email: string;
  imageUrl: string | undefined;
  githubUsername: string | undefined;
};

export function AccountTab({
  name,
  email,
  imageUrl,
  githubUsername,
}: AccountTabProps) {
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
        <GitHubTokenInput />
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

function GitHubTokenInput() {
  const { token, setToken, showToken, setShowToken, isSaving, handleSave } =
    useGithubTokenInput();

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
