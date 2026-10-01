import assert from "node:assert/strict";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  documentEditorFeatures,
  NOTE_EDITOR_FEATURES,
  targetProjectId,
} from "@wryte/logic/lib/editor/features";

assert.deepEqual(documentEditorFeatures(undefined), {
  mdx: false,
  readability: false,
  animations: false,
  slash: false,
  snippets: false,
  hasSnippets: false,
  selectionToolbar: true,
});

assert.deepEqual(
  documentEditorFeatures({
    contentFormat: "mdx",
    animationsPath: "components/animations",
    readabilityLensEnabled: true,
    slashCommandsEnabled: true,
    snippetsEnabled: true,
    snippetCount: 2,
    selectionToolbarEnabled: false,
  }),
  {
    mdx: true,
    readability: true,
    animations: true,
    slash: true,
    snippets: true,
    hasSnippets: true,
    selectionToolbar: false,
  },
);

assert.equal(
  documentEditorFeatures({ contentFormat: "mdx", animationsPath: "a" })
    .animations,
  true,
);
assert.equal(
  documentEditorFeatures({
    contentFormat: "mdx",
    animationsPath: "a",
    animationsEnabled: false,
  }).animations,
  false,
);
assert.equal(
  documentEditorFeatures({ contentFormat: "md", animationsPath: "a" })
    .animations,
  false,
);

assert.equal(NOTE_EDITOR_FEATURES.slash, true);
assert.equal(NOTE_EDITOR_FEATURES.snippets, false);
assert.equal(NOTE_EDITOR_FEATURES.animations, false);
assert.equal(NOTE_EDITOR_FEATURES.readability, false);

const projectId = "p1" as Id<"projects">;
assert.equal(
  targetProjectId({
    kind: "document",
    documentId: "d1" as Id<"documents">,
    projectId,
  }),
  projectId,
);
assert.equal(
  targetProjectId({ kind: "note", noteId: "n1" as Id<"notes"> }),
  null,
);
assert.equal(targetProjectId(null), null);

console.info("editor-features: all assertions passed");
