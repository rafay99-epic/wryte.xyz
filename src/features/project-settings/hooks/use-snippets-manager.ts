import { useMutation, usePaginatedQuery } from "convex/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { SNIPPETS_PAGE_SIZE } from "@/types/snippets";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * Paginated CRUD for a project's snippets. The list rides a paginated query so
 * the settings screen never loads thousands at once; create/update/remove are
 * granular mutations. Per-row edit debouncing lives in the row component.
 */
export function useSnippetsManager(projectId: Id<"projects">) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.cms.snippets.list,
    { projectId },
    { initialNumItems: SNIPPETS_PAGE_SIZE },
  );

  const createSnippet = useMutation(api.cms.snippets.create);
  const updateSnippet = useMutation(api.cms.snippets.update);
  const removeSnippet = useMutation(api.cms.snippets.remove);

  const [isCreating, setIsCreating] = useState(false);

  const create = useCallback(
    async (name: string, content: string): Promise<boolean> => {
      setIsCreating(true);
      try {
        await createSnippet({ projectId, name, content });
        toast.success("Snippet added");
        return true;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to add snippet",
        );
        return false;
      } finally {
        setIsCreating(false);
      }
    },
    [createSnippet, projectId],
  );

  const update = useCallback(
    (snippetId: Id<"snippets">, patch: { name?: string; content?: string }) => {
      void updateSnippet({ snippetId, ...patch }).catch((err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to save snippet",
        );
      });
    },
    [updateSnippet],
  );

  const remove = useCallback(
    async (snippetId: Id<"snippets">): Promise<void> => {
      try {
        await removeSnippet({ snippetId });
        toast.success("Snippet removed");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to remove snippet",
        );
      }
    },
    [removeSnippet],
  );

  return { results, status, loadMore, isCreating, create, update, remove };
}
