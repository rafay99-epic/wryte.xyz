import type { Id } from "@wryte/backend/_generated/dataModel";
import type { EditorTarget } from "./target";

export type DocumentEditorTarget = Extract<EditorTarget, { kind: "document" }>;

export type NoteEditorTarget = Extract<EditorTarget, { kind: "note" }>;

export type EditorFeatures = {
  mdx: boolean;
  readability: boolean;
  animations: boolean;
  slash: boolean;
  snippets: boolean;
  hasSnippets: boolean;
  selectionToolbar: boolean;
};

type ProjectEditorSettings = {
  contentFormat?: string;
  readabilityLensEnabled?: boolean;
  animationsPath?: string;
  animationsEnabled?: boolean;
  slashCommandsEnabled?: boolean;
  snippetsEnabled?: boolean;
  selectionToolbarEnabled?: boolean;
  snippetCount?: number;
};

export const NOTE_EDITOR_FEATURES: EditorFeatures = {
  mdx: false,
  readability: false,
  animations: false,
  slash: true,
  snippets: false,
  hasSnippets: false,
  selectionToolbar: true,
};

export function documentEditorFeatures(
  project: ProjectEditorSettings | null | undefined,
): EditorFeatures {
  const mdx = project?.contentFormat === "mdx";
  return {
    mdx,
    readability: project?.readabilityLensEnabled ?? false,
    animations:
      mdx && !!project?.animationsPath && (project.animationsEnabled ?? true),
    slash: project?.slashCommandsEnabled ?? false,
    snippets: project?.snippetsEnabled ?? false,
    hasSnippets: (project?.snippetCount ?? 0) > 0,
    selectionToolbar: project?.selectionToolbarEnabled ?? true,
  };
}

export function targetProjectId(
  target: EditorTarget | null,
): Id<"projects"> | null {
  return target?.kind === "document" ? target.projectId : null;
}
