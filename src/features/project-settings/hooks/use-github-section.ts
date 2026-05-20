import { useAction, useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useGithubBranches } from "@/hooks/use-github";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { ProjectData, VerifyStatus } from "../types";

type UseGithubSectionParams = {
  projectId: Id<"projects">;
  project: ProjectData;
  existingToken: string;
};

export function useGithubSection({
  projectId,
  project,
  existingToken,
}: UseGithubSectionParams) {
  const updateProject = useMutation(api.cms.projects.update);
  const updateGithubToken = useAction(api.account.users.updateGithubToken);
  const verifyRepoAccess = useAction(api.integrations.github.verifyRepoAccess);

  const [oauthConnected, setOauthConnected] = useState<boolean | null>(null);
  const [oauthToken, setOauthToken] = useState<string | null>(null);

  const [token, setToken] = useState(existingToken);
  const [showToken, setShowToken] = useState(false);
  const [showPatFallback, setShowPatFallback] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false);

  const [repo, setRepo] = useState(project.githubRepo ?? "");
  const [branch, setBranch] = useState(project.githubBranch ?? "main");
  const [isSavingRepo, setIsSavingRepo] = useState(false);

  const repoLooksValid = /^[^/]+\/[^/]+$/.test(repo.trim());
  const {
    data: branchesData,
    isLoading: isLoadingBranches,
    error: branchesError,
  } = useGithubBranches(repoLooksValid ? repo.trim() : null);
  const availableBranches = branchesData?.branches ?? [];
  const defaultBranch = branchesData?.defaultBranch;

  useEffect(() => {
    if (!defaultBranch) return;
    if (availableBranches.length === 0) return;
    if (!availableBranches.includes(branch)) {
      setBranch(defaultBranch);
    }
  }, [defaultBranch, availableBranches, branch]);

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>(
    project.githubRepo ? "connected" : "idle",
  );
  const [verifyError, setVerifyError] = useState("");

  useEffect(() => {
    async function checkOAuth() {
      try {
        const res = await fetch("/api/github/token");
        if (res.ok) {
          const data = (await res.json()) as { token?: string };
          if (data.token) {
            setOauthConnected(true);
            setOauthToken(data.token);
            return;
          }
        }
        setOauthConnected(false);
      } catch {
        setOauthConnected(false);
      }
    }
    void checkOAuth();
  }, []);

  useEffect(() => {
    setToken(existingToken);
  }, [existingToken]);

  useEffect(() => {
    setRepo(project.githubRepo ?? "");
    setBranch(project.githubBranch ?? "main");
  }, [project.githubRepo, project.githubBranch]);

  const handleSaveToken = useCallback(async () => {
    if (!token.trim()) {
      toast.error("Token is required");
      return;
    }
    setIsSavingToken(true);
    try {
      await updateGithubToken({ token: token.trim() });
      toast.success("GitHub token saved");
    } catch {
      toast.error("Failed to save token");
    } finally {
      setIsSavingToken(false);
    }
  }, [token, updateGithubToken]);

  const repoHasChanges =
    repo.trim() !== (project.githubRepo ?? "") ||
    branch.trim() !== (project.githubBranch ?? "main");

  const handleSaveRepo = useCallback(async () => {
    const trimmedRepo = repo.trim();
    if (!trimmedRepo) {
      toast.error("Repository is required");
      return;
    }
    if (!/^[^/]+\/[^/]+$/.test(trimmedRepo)) {
      toast.error('Repository must be in "owner/repo" format');
      return;
    }
    setIsSavingRepo(true);
    try {
      await updateProject({
        projectId,
        githubRepo: trimmedRepo,
        githubBranch: branch.trim() || "main",
      });
      toast.success("Repository settings saved");
    } catch {
      toast.error("Failed to save repository settings");
    } finally {
      setIsSavingRepo(false);
    }
  }, [repo, branch, projectId, updateProject]);

  const handleVerify = useCallback(async () => {
    const trimmedRepo = repo.trim();
    const verifyToken = oauthToken ?? token.trim();
    if (!verifyToken) {
      toast.error(
        "Connect GitHub via OAuth or save a Personal Access Token first",
      );
      return;
    }
    if (!trimmedRepo) {
      toast.error("Enter a repository to verify");
      return;
    }
    setVerifyStatus("verifying");
    setVerifyError("");
    try {
      const result = await verifyRepoAccess({
        token: verifyToken,
        repo: trimmedRepo,
      });
      if (result.valid) {
        setVerifyStatus("connected");
        toast.success("Repository access verified");
      } else {
        setVerifyStatus("error");
        setVerifyError(result.error ?? "Verification failed");
        toast.error(result.error ?? "Verification failed");
      }
    } catch {
      setVerifyStatus("error");
      setVerifyError("Failed to verify repository access");
      toast.error("Failed to verify repository access");
    }
  }, [repo, token, oauthToken, verifyRepoAccess]);

  return {
    oauthConnected,
    oauthToken,
    token,
    setToken,
    showToken,
    setShowToken,
    showPatFallback,
    setShowPatFallback,
    isSavingToken,
    repo,
    setRepo,
    branch,
    setBranch,
    isSavingRepo,
    availableBranches,
    defaultBranch,
    isLoadingBranches,
    branchesError,
    verifyStatus,
    verifyError,
    repoHasChanges,
    handleSaveToken,
    handleSaveRepo,
    handleVerify,
  };
}
