"use client";

import { motion } from "framer-motion";
import { Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useDeploymentSection } from "../hooks/use-deployment-section";
import type { ProjectData } from "../types";
import { FieldGroup, SectionHeader } from "./shared";

export function DeploymentSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const enabled = project.deployVerificationEnabled ?? false;
  const {
    targets,
    handleToggle,
    token,
    setToken,
    vercelProject,
    setVercelProject,
    teamId,
    setTeamId,
    isConnecting,
    handleConnect,
    handleRemove,
  } = useDeploymentSection({ projectId, enabled });

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={ShieldCheck}
        title="Deployment Verification"
        description="Get an email when a post is committed but your site fails to deploy it"
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
      >
        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium">Verify deployments</p>
            <p className="text-xs text-muted-foreground">
              After each publish, confirm your site actually rebuilt — and email
              you when it didn't.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => void handleToggle(checked)}
          />
        </div>

        {enabled && (
          <>
            <p className="text-xs text-muted-foreground">
              Without an integration, new posts are verified by checking their
              public URL after publishing (requires a site URL in General
              settings). Connect Vercel for exact build status, failure
              detection on updates, and links to build logs.
            </p>

            {targets && targets.length > 0 && (
              <div className="space-y-2">
                {targets.map((target) => (
                  <div
                    key={target._id}
                    className="flex items-center justify-between rounded-xl border border-border/40 bg-card px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">Vercel</p>
                      <p className="text-xs text-muted-foreground">
                        Project{" "}
                        <code className="rounded bg-muted px-1 py-px text-[10px]">
                          {target.providerProjectId}
                        </code>
                        {target.teamId ? ` · team ${target.teamId}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleRemove(target._id)}
                      aria-label="Remove deployment integration"
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <FieldGroup
              label="Vercel API Token"
              htmlFor="s-vercel-token"
              hint="Create at vercel.com → Account Settings → Tokens. Stored encrypted in a secret vault, never in the database."
            >
              <Input
                id="s-vercel-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="vercel_xxxxxxxx"
                className="font-mono text-sm"
                autoComplete="off"
              />
            </FieldGroup>

            <FieldGroup
              label="Vercel Project"
              htmlFor="s-vercel-project"
              hint="Project name or ID exactly as shown in the Vercel dashboard"
            >
              <Input
                id="s-vercel-project"
                value={vercelProject}
                onChange={(e) => setVercelProject(e.target.value)}
                placeholder="my-blog"
                className="font-mono text-sm"
              />
            </FieldGroup>

            <FieldGroup
              label="Team ID"
              htmlFor="s-vercel-team"
              hint="Only needed when the project belongs to a Vercel team"
            >
              <Input
                id="s-vercel-team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                placeholder="team_xxxxxxxx (optional)"
                className="font-mono text-sm"
              />
            </FieldGroup>

            <Button
              onClick={() => void handleConnect()}
              disabled={isConnecting || !token.trim() || !vercelProject.trim()}
            >
              {isConnecting && <Loader2 className="size-4 animate-spin" />}
              {isConnecting ? "Verifying token…" : "Connect Vercel"}
            </Button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
