import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type { ConfigFormat } from "@wryte/backend/_lib/configFiles";
import { useSaveShortcut } from "@wryte/logic/hooks/use-save-shortcut";
import { applyConfigEdit, type ConfigEdit } from "@wryte/logic/lib/config/edit";
import { parseConfig, usesJsonComments } from "@wryte/logic/lib/config/parse";
import { useAction, useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ConfigSource } from "./use-config-source";

type Busy = "saving" | "publishing" | "discarding" | null;

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useConfigDocument({
  projectId,
  path,
  format,
  source,
}: {
  projectId: Id<"projects">;
  path: string;
  format: ConfigFormat;
  source: ConfigSource;
}) {
  const saveDraft = useMutation(api.cms.configFiles.saveDraft);
  const discardDraft = useMutation(api.cms.configFiles.discardDraft);
  const readFile = useAction(api.integrations.githubConfig.readFile);
  const publishFile = useAction(api.integrations.githubConfig.publish);

  const initialText = source.draft?.content ?? source.remote.content;
  const [text, setText] = useState(initialText);
  const [savedText, setSavedText] = useState(initialText);
  const [remote, setRemote] = useState(source.remote);
  const [baseSha, setBaseSha] = useState(
    source.draft?.baseSha ?? source.remote.sha,
  );
  const [conflict, setConflict] = useState(
    source.draft !== null && source.draft.baseSha !== source.remote.sha,
  );
  const [busy, setBusy] = useState<Busy>(null);

  const [jsonComments] = useState(
    () => format === "json" && usesJsonComments(source.remote.content),
  );
  const parsed = useMemo(
    () => parseConfig(text, format, { jsonComments }),
    [text, format, jsonComments],
  );
  const unsaved = text !== savedText;
  const unpublished = text !== remote.content;

  const persist = useCallback(
    async (content: string) => {
      if (content === remote.content) {
        await discardDraft({ projectId, path });
      } else {
        await saveDraft({ projectId, path, content, baseSha });
      }
      setSavedText(content);
    },
    [baseSha, discardDraft, path, projectId, remote.content, saveDraft],
  );

  const save = useCallback(async () => {
    if (!unsaved || busy) return;
    setBusy("saving");
    try {
      await persist(text);
    } catch (error: unknown) {
      toast.error(errorText(error, "Couldn't save this file"));
    } finally {
      setBusy(null);
    }
  }, [busy, persist, text, unsaved]);

  const publish = useCallback(
    async (overwrite: boolean) => {
      if (busy || !parsed.ok || !unpublished) return;
      const content = text;
      setBusy("publishing");
      try {
        if (content !== savedText) await persist(content);
        const result = await publishFile({ projectId, path, overwrite });
        if (result.status === "conflict") {
          setConflict(true);
          return;
        }
        setRemote({ content, sha: result.sha });
        setBaseSha(result.sha);
        setConflict(false);
        toast.success("Published to GitHub");
      } catch (error: unknown) {
        toast.error(errorText(error, "Couldn't publish this file"));
      } finally {
        setBusy(null);
      }
    },
    [
      busy,
      parsed.ok,
      path,
      persist,
      projectId,
      publishFile,
      savedText,
      text,
      unpublished,
    ],
  );

  const discard = useCallback(async () => {
    if (busy) return;
    setBusy("discarding");
    try {
      const fresh = await readFile({ projectId, path });
      await discardDraft({ projectId, path });
      setRemote(fresh);
      setBaseSha(fresh.sha);
      setText(fresh.content);
      setSavedText(fresh.content);
      setConflict(false);
    } catch (error: unknown) {
      toast.error(errorText(error, "Couldn't discard your edits"));
    } finally {
      setBusy(null);
    }
  }, [busy, discardDraft, path, projectId, readFile]);

  const edit = useCallback(
    (change: ConfigEdit) => {
      try {
        setText(applyConfigEdit(text, format, change));
      } catch (error: unknown) {
        toast.error(errorText(error, "Couldn't apply that change"));
      }
    },
    [format, text],
  );

  useSaveShortcut(() => {
    void save();
  });

  const pending = useRef({ text, unsaved, persist, path });
  useEffect(() => {
    pending.current = { text, unsaved, persist, path };
  });
  useEffect(() => {
    return () => {
      const latest = pending.current;
      if (!latest.unsaved) return;
      void latest.persist(latest.text).catch((error: unknown) => {
        toast.error(
          errorText(error, `Couldn't save your edits to ${latest.path}`),
        );
      });
    };
  }, []);

  useEffect(() => {
    if (!unsaved) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [unsaved]);

  return {
    text,
    baseText: remote.content,
    setText,
    parsed,
    unsaved,
    unpublished,
    conflict,
    busy,
    save,
    publish,
    discard,
    edit,
  };
}
