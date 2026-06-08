"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AI_PROVIDER_MARKS } from "@/components/branding/provider-logos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ALL_PROVIDERS, getProvider } from "@/types/ai";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAiSection } from "../hooks/use-ai-section";
import type { AiProviderId, ProjectData } from "../types";
import { Divider, FieldGroup, SaveButton, SectionHeader } from "./shared";

export function AiSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const {
    provider,
    model,
    setModel,
    isSaving,
    models,
    hasChanges,
    handleProviderChange,
    handleSave,
  } = useAiSection({ projectId, project });

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={staggerItem}>
        <SectionHeader
          icon={Sparkles}
          title="AI Enhancement"
          description="Configure the AI provider and model for content enhancement."
        />
      </motion.div>

      <motion.div variants={staggerItem} className="space-y-5">
        <FieldGroup
          label="Provider"
          hint="Service used when you run enhancements in the editor."
        >
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="AI provider"
          >
            {ALL_PROVIDERS.map((p) => {
              const selected = provider === p.id;
              const Mark = AI_PROVIDER_MARKS[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => handleProviderChange(p.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    selected
                      ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Mark
                    className={cn(
                      p.kind === "anthropic-native" && "size-6",
                      p.id === "openai" && "size-6",
                      p.id === "google" && "size-6",
                    )}
                  />
                  {p.label}
                </button>
              );
            })}
          </div>
        </FieldGroup>

        <FieldGroup
          label="Model"
          hint={
            provider
              ? "Model used for rewrites and enhancements."
              : "Select a provider first to see available models."
          }
        >
          {provider ? (
            <div
              className="space-y-1.5"
              role="radiogroup"
              aria-label="AI model"
            >
              {models.map((m) => {
                const selected = model === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setModel(m.value)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      selected
                        ? "border-primary/40 bg-primary/5 shadow-sm"
                        : "border-border/40 bg-transparent hover:border-border hover:bg-muted/30",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        selected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30",
                      )}
                    >
                      {selected && (
                        <div className="size-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          selected
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {m.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60">
                        {m.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground/50">
                Select a provider above to see available models
              </p>
            </div>
          )}
        </FieldGroup>

        <Divider />

        {provider ? (
          <AiCredentialsForm
            projectId={projectId}
            provider={provider as AiProviderId}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center">
            <p className="text-xs text-muted-foreground/50">
              Select a provider above to add your API key
            </p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <SaveButton
            isSaving={isSaving}
            disabled={!hasChanges || !provider || !model}
            onClick={() => void handleSave()}
          />
        </div>

        <Divider />

        <PromptTemplatesEditor projectId={projectId} />
      </motion.div>
    </motion.div>
  );
}

function PromptTemplatesEditor({ projectId }: { projectId: Id<"projects"> }) {
  const templates = useQuery(api.ai.promptTemplates.getTemplates, {
    projectId,
  });
  const addTemplate = useMutation(api.ai.promptTemplates.addTemplate);
  const removeTemplate = useMutation(api.ai.promptTemplates.removeTemplate);
  const updateTemplates = useMutation(api.ai.promptTemplates.updateTemplates);

  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleAdd = useCallback(async () => {
    const name = newName.trim();
    const prompt = newPrompt.trim();
    if (!name || !prompt) return;

    setIsAdding(true);
    try {
      await addTemplate({ projectId, name, prompt });
      setNewName("");
      setNewPrompt("");
      toast.success("Template added");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add template",
      );
    } finally {
      setIsAdding(false);
    }
  }, [addTemplate, projectId, newName, newPrompt]);

  const handleRemove = useCallback(
    async (templateId: string) => {
      try {
        await removeTemplate({ projectId, templateId });
        toast.success("Template removed");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to remove template",
        );
      }
    },
    [removeTemplate, projectId],
  );

  const handleFieldChange = useCallback(
    (
      templateId: string,
      field: "name" | "prompt",
      value: string,
      currentTemplates: typeof templates,
    ) => {
      if (!currentTemplates) return;

      const updated = currentTemplates.map((t) =>
        t.id === templateId ? { ...t, [field]: value } : t,
      );

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void updateTemplates({
          projectId,
          templates: JSON.stringify(updated),
        });
      }, 600);
    },
    [updateTemplates, projectId],
  );

  const atLimit = (templates?.length ?? 0) >= 20;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Prompt Templates
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/60">
          Reusable instructions that appear as quick-apply pills in the inline
          AI popover (Mod+J).
        </p>
      </div>

      {templates === undefined ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground/50">
            No templates yet. Add one below.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <PromptTemplateRow
              key={t.id}
              template={t}
              onRemove={() => void handleRemove(t.id)}
              onChange={(field, value) =>
                handleFieldChange(t.id, field, value, templates)
              }
            />
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-border/40 bg-muted/10 p-3">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Template name"
          className="h-8 text-[13px]"
          disabled={atLimit}
        />
        <Input
          value={newPrompt}
          onChange={(e) => setNewPrompt(e.target.value)}
          placeholder="Instruction prompt"
          className="h-8 text-[13px]"
          disabled={atLimit}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAdd();
          }}
        />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground/50">
            {atLimit
              ? "Maximum 20 templates reached"
              : `${templates?.length ?? 0}/20 templates`}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleAdd()}
            disabled={
              isAdding || !newName.trim() || !newPrompt.trim() || atLimit
            }
            className="h-7 gap-1 text-xs"
          >
            {isAdding ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Plus className="size-3" />
            )}
            Add template
          </Button>
        </div>
      </div>
    </div>
  );
}

function PromptTemplateRow({
  template,
  onRemove,
  onChange,
}: {
  template: { id: string; name: string; prompt: string };
  onRemove: () => void;
  onChange: (field: "name" | "prompt", value: string) => void;
}) {
  const [name, setName] = useState(template.name);
  const [prompt, setPrompt] = useState(template.prompt);

  useEffect(() => {
    setName(template.name);
    setPrompt(template.prompt);
  }, [template.name, template.prompt]);

  return (
    <div className="group flex items-start gap-2 rounded-lg border border-border/40 bg-background p-2.5">
      <div className="min-w-0 flex-1 space-y-1.5">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            onChange("name", e.target.value);
          }}
          className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50"
          placeholder="Template name"
        />
        <input
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            onChange("prompt", e.target.value);
          }}
          className="w-full bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/40"
          placeholder="Instruction prompt"
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="mt-1 shrink-0 rounded-md p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        aria-label="Remove template"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function AiCredentialsForm({
  projectId,
  provider,
}: {
  projectId: Id<"projects">;
  provider: AiProviderId;
}) {
  const config = useQuery(api.ai.credentialsDb.getPublicConfig, {
    projectId,
    provider,
  });

  const setCredentials = useAction(api.ai.credentials.setCredentials);
  const testCredentials = useAction(api.ai.credentials.testCredentials);
  const rotate = useAction(api.ai.credentials.rotate);
  const deleteCredentials = useAction(api.ai.credentials.deleteCredentials);

  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState<"save" | "test" | "delete" | null>(null);

  const hasExisting = config !== null && config !== undefined;
  const isRotating = config?.status === "rotating";

  useEffect(() => {
    setSecret("");
  }, []);

  const entry = getProvider(provider);
  const placeholder = entry.keyPrefixHint;
  const dashboardLink = entry.dashboardUrl;

  const handleSave = useCallback(async () => {
    const trimmed = secret.trim();
    if (!trimmed) {
      toast.error("Paste your API key before saving.");
      return;
    }
    setBusy("save");
    try {
      const result = hasExisting
        ? await rotate({ projectId, provider, secret: trimmed })
        : await setCredentials({ projectId, provider, secret: trimmed });
      if (result.ok) {
        toast.success(
          hasExisting ? "API key rotated." : `${provider} key saved.`,
        );
        setSecret("");
      } else {
        toast.error(result.message ?? "Key failed verification.");
      }
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to save API key."),
      );
    } finally {
      setBusy(null);
    }
  }, [hasExisting, projectId, provider, rotate, secret, setCredentials]);

  const handleTest = useCallback(async () => {
    setBusy("test");
    try {
      const result = await testCredentials({ projectId, provider });
      if (result.ok) toast.success("Connection looks good.");
      else toast.error(result.message ?? "Connection failed.");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ?? (err instanceof Error ? err.message : "Test failed."),
      );
    } finally {
      setBusy(null);
    }
  }, [projectId, provider, testCredentials]);

  const handleDelete = useCallback(async () => {
    if (
      !window.confirm(
        "Remove this API key? AI enhancements will stop working until you reconfigure.",
      )
    ) {
      return;
    }
    setBusy("delete");
    try {
      await deleteCredentials({ projectId, provider });
      toast.success("API key removed.");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to remove."),
      );
    } finally {
      setBusy(null);
    }
  }, [deleteCredentials, projectId, provider]);

  const providerLabel = entry.label;

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{providerLabel} API key</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Stored encrypted in the secret vault. Verification doesn't consume
            any tokens.{" "}
            <a
              href={dashboardLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline-offset-2 hover:underline"
            >
              Get your key →
            </a>
          </p>
        </div>
        {hasExisting && <AiStatusBadge status={config.status} />}
      </div>

      {hasExisting && config.lastVerifyError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          <span className="font-medium">Last error:</span>{" "}
          {config.lastVerifyError}
        </div>
      )}

      <FieldGroup
        label={hasExisting ? "Replace API key" : "API key"}
        htmlFor="ai-secret"
      >
        <div className="relative">
          <Input
            id="ai-secret"
            type={showSecret ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={
              hasExisting ? "Paste a new key to rotate..." : placeholder
            }
            autoComplete="off"
            spellCheck={false}
            className="pr-9 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => setShowSecret((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showSecret ? "Hide" : "Show"}
          >
            {showSecret ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </button>
        </div>
      </FieldGroup>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={busy !== null || isRotating}
        >
          {busy === "save" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Saving...
            </>
          ) : hasExisting ? (
            "Replace key"
          ) : (
            "Save"
          )}
        </Button>
        {hasExisting && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={busy !== null || isRotating}
          >
            {busy === "test" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Testing...
              </>
            ) : (
              "Test connection"
            )}
          </Button>
        )}
        {hasExisting && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={busy !== null || isRotating}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {busy === "delete" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            Remove
          </Button>
        )}
        {hasExisting && config.lastVerifiedAt && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Last verified{" "}
            {new Date(config.lastVerifiedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function AiStatusBadge({
  status,
}: {
  status: "active" | "verifying" | "invalid" | "rotating";
}) {
  const styles: Record<typeof status, string> = {
    active:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    verifying:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    invalid: "bg-destructive/10 text-destructive border-destructive/30",
    rotating:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  };
  const label: Record<typeof status, string> = {
    active: "Active",
    verifying: "Verifying",
    invalid: "Invalid",
    rotating: "Rotating",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        styles[status],
      )}
    >
      {label[status]}
    </span>
  );
}
