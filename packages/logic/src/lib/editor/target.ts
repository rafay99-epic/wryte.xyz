import type { Id } from "@wryte/backend/_generated/dataModel";

export type EditorTarget =
  | {
      kind: "document";
      documentId: Id<"documents">;
      projectId: Id<"projects">;
    }
  | { kind: "note"; noteId: Id<"notes"> };

export function editorTargetId(target: EditorTarget): string {
  return target.kind === "document" ? target.documentId : target.noteId;
}
