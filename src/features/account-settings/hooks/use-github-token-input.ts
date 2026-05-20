import { useAction } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";

export function useGithubTokenInput(existingToken: string) {
  const updateGithubToken = useAction(api.account.users.updateGithubToken);
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

  return {
    token,
    setToken,
    showToken,
    setShowToken,
    isSaving,
    handleSave,
  };
}
