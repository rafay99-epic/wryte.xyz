import { useMutation } from "convex/react";
import type * as React from "react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * Shared tag-editing logic used by both the board card inline editor
 * and the TagEditorPopover. Owns the local tag list, input state,
 * add/remove mutations, and keyboard handling (Enter, comma, Backspace).
 *
 * Escape is NOT handled here — consumers attach their own close logic.
 */
export function useTagEditor({
  documentId,
  initialTags,
}: {
  documentId: string | undefined;
  initialTags: string[];
}) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const updateTagsMutation = useMutation(api.cms.documents.updateTags);

  const persistTags = useCallback(
    async (nextTags: string[]) => {
      if (!documentId) return;
      try {
        await updateTagsMutation({
          documentId: documentId as Id<"documents">,
          tags: nextTags,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update tags";
        toast.error(message);
      }
    },
    [documentId, updateTagsMutation],
  );

  const addTag = useCallback(
    (raw: string) => {
      const tag = raw.trim().toLowerCase().replace(/,/g, "");
      if (!tag || tags.includes(tag)) {
        setInputValue("");
        return;
      }
      const nextTags = [...tags, tag];
      setTags(nextTags);
      setInputValue("");
      void persistTags(nextTags);
    },
    [tags, persistTags],
  );

  const removeTag = useCallback(
    (tag: string) => {
      const nextTags = tags.filter((t) => t !== tag);
      setTags(nextTags);
      void persistTags(nextTags);
    },
    [tags, persistTags],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag(inputValue);
      } else if (
        e.key === "Backspace" &&
        inputValue === "" &&
        tags.length > 0
      ) {
        const last = tags[tags.length - 1];
        if (last !== undefined) {
          removeTag(last);
        }
      }
    },
    [inputValue, tags, addTag, removeTag],
  );

  const resetTags = useCallback((newTags: string[]) => {
    setTags(newTags);
    setInputValue("");
  }, []);

  return {
    tags,
    inputValue,
    inputRef,
    setInputValue,
    addTag,
    removeTag,
    handleKeyDown,
    resetTags,
  };
}
