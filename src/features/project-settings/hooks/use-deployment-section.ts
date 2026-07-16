import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export function useDeploymentSection({
  projectId,
  enabled,
}: {
  projectId: Id<"projects">;
  enabled: boolean;
}) {
  const targets = useQuery(
    api.deployments.targets.list,
    enabled ? { projectId } : "skip",
  );
  const connectVercel = useAction(api.deployments.targets.connectVercel);
  const removeTarget = useMutation(api.deployments.targets.remove);
  const updateProject = useMutation(api.cms.projects.update);

  const [token, setToken] = useState("");
  const [vercelProject, setVercelProject] = useState("");
  const [teamId, setTeamId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const handleToggle = async (next: boolean) => {
    try {
      await updateProject({ projectId, deployVerificationEnabled: next });
      toast.success(
        next
          ? "Deployment verification enabled"
          : "Deployment verification disabled",
      );
    } catch {
      toast.error("Failed to update setting");
    }
  };

  const handleConnect = async () => {
    if (!token.trim() || !vercelProject.trim()) {
      toast.error("API token and project name are required");
      return;
    }
    setIsConnecting(true);
    try {
      await connectVercel({
        projectId,
        token: token.trim(),
        vercelProject: vercelProject.trim(),
        ...(teamId.trim() ? { teamId: teamId.trim() } : {}),
      });
      setToken("");
      setVercelProject("");
      setTeamId("");
      toast.success("Vercel connected — deployments will now be verified");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to connect Vercel",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRemove = async (targetId: Id<"deployment_targets">) => {
    try {
      await removeTarget({ targetId });
      toast.success("Deployment integration removed");
    } catch {
      toast.error("Failed to remove integration");
    }
  };

  return {
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
  };
}
