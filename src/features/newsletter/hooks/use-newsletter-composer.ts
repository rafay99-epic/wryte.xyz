import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

function reportErr(err: unknown, fallback: string) {
  const data = (err as { data?: { message?: string } })?.data;
  toast.error(data?.message ?? (err instanceof Error ? err.message : fallback));
}

/**
 * Composer state for one newsletter, loaded by slug.
 *
 * Navigation-safe: sets `activeProjectId` on mount (so the sidebar stays in
 * project mode) and NEVER calls the global editor store's `reset()` — that
 * was the bug that broke Back. The body lives in the shared editor store (so
 * the real MarkdownEditor works); the email metadata lives here.
 */
export function useNewsletterComposer(projectId: Id<"projects">, slug: string) {
  const newsletter = useQuery(api.newsletter.newsletters.getBySlug, {
    projectId,
    slug,
  });
  const connection = useQuery(api.newsletter.connections.get, { projectId });
  const project = useQuery(api.cms.projects.get, { projectId });

  const update = useMutation(api.newsletter.newsletters.update);
  const removeMutation = useMutation(api.newsletter.newsletters.remove);
  const sendNewsletter = useAction(api.newsletter.send.sendNewsletter);
  const sendTest = useAction(api.newsletter.send.sendTest);

  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [fromName, setFromName] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [listId, setListId] = useState("");
  const [busy, setBusy] = useState<"test" | "send" | "schedule" | null>(null);

  const newsletterId = newsletter?._id ?? null;
  const status = newsletter?.status ?? "draft";
  const locked = status === "sent" || status === "scheduled";

  // Load once — seed metadata locally, load the body into the shared editor
  // store, and pin the active project. No reset on unmount.
  const initedRef = useRef(false);
  useEffect(() => {
    if (!newsletter || initedRef.current) return;
    initedRef.current = true;
    setSubject(newsletter.subject);
    setPreviewText(newsletter.previewText ?? "");
    setFromName(newsletter.fromName ?? "");
    setInternalNote(newsletter.internalNote ?? "");
    setListId(newsletter.listId ?? "");
    const store = useEditorStore.getState();
    store.setActiveProjectId(projectId);
    store.initDocument("", newsletter.bodyMarkdown, projectId);
  }, [newsletter, projectId]);

  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(projectId);
  }, [projectId]);

  // Persist the latest body + metadata. Returns after the write so send/test
  // never race the debounce.
  const flush = useCallback(async () => {
    if (!newsletterId || locked) return;
    await update({
      newsletterId,
      subject,
      previewText,
      fromName,
      internalNote,
      listId,
      bodyMarkdown: useEditorStore.getState().content,
    });
  }, [
    newsletterId,
    locked,
    subject,
    previewText,
    fromName,
    internalNote,
    listId,
    update,
  ]);

  // Debounced autosave of the metadata fields.
  useEffect(() => {
    if (!initedRef.current || locked || !newsletterId) return;
    const t = setTimeout(() => {
      void update({
        newsletterId,
        subject,
        previewText,
        fromName,
        internalNote,
        listId,
      }).catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [
    subject,
    previewText,
    fromName,
    internalNote,
    listId,
    locked,
    newsletterId,
    update,
  ]);

  // Flush the body on unmount so navigating away never drops work.
  useEffect(() => {
    return () => {
      const nid = newsletterId;
      if (!nid) return;
      const body = useEditorStore.getState().content;
      void update({ newsletterId: nid, bodyMarkdown: body }).catch(() => {});
    };
  }, [newsletterId, update]);

  const doTest = useCallback(
    async (email: string) => {
      if (!newsletterId) return;
      setBusy("test");
      try {
        await flush();
        const res = await sendTest({ newsletterId, email });
        if (res.ok) toast.success("Test sent — check your inbox.");
        else toast.error(res.message ?? "Test failed.");
      } catch (err) {
        reportErr(err, "Test failed");
      } finally {
        setBusy(null);
      }
    },
    [newsletterId, flush, sendTest],
  );

  const doSend = useCallback(
    async (scheduledAtMs?: number) => {
      if (!newsletterId) return;
      if (!listId) {
        toast.error("Pick an audience first.");
        return;
      }
      setBusy(scheduledAtMs ? "schedule" : "send");
      try {
        await flush();
        const res = await sendNewsletter({
          newsletterId,
          listId,
          ...(scheduledAtMs !== undefined ? { scheduledAtMs } : {}),
        });
        if (res.ok) {
          toast.success(
            res.status === "scheduled" ? "Scheduled" : "Sent to your list",
          );
          return true;
        }
        toast.error(res.message ?? "Send failed.");
        return false;
      } catch (err) {
        reportErr(err, "Send failed");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [newsletterId, listId, flush, sendNewsletter],
  );

  const doDelete = useCallback(async () => {
    if (!newsletterId) return;
    await removeMutation({ newsletterId });
  }, [newsletterId, removeMutation]);

  return {
    newsletter,
    connection,
    project,
    status,
    locked,
    subject,
    setSubject,
    previewText,
    setPreviewText,
    fromName,
    setFromName,
    internalNote,
    setInternalNote,
    listId,
    setListId,
    busy,
    flush,
    doTest,
    doSend,
    doDelete,
  };
}
