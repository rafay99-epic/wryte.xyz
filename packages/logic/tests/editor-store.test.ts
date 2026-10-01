import assert from "node:assert/strict";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type { EditorTarget } from "@wryte/logic/lib/editor/target";
import { useEditorStore } from "@wryte/logic/stores/editor-store";

const article: EditorTarget = {
  kind: "document",
  documentId: "d1" as Id<"documents">,
  projectId: "p1" as Id<"projects">,
};
const note: EditorTarget = { kind: "note", noteId: "n1" as Id<"notes"> };

const store = useEditorStore.getState();

store.initDocument("Article", "body", article);
assert.equal(useEditorStore.getState().activeProjectId, "p1");
assert.equal(useEditorStore.getState().isDirty, false);

store.setActiveDraftId("draft-1");
store.toggleHistoryPanel();
store.toggleResearchPanel();
store.initDocument("Draft", "draft body", article);
assert.equal(useEditorStore.getState().activeDraftId, "draft-1");
assert.equal(useEditorStore.getState().historyPanelOpen, true);

store.setContent("edited");
store.initDocument("Note", "note body", note);
const afterNote = useEditorStore.getState();
assert.equal(afterNote.activeDraftId, null);
assert.equal(afterNote.historyPanelOpen, false);
assert.equal(afterNote.researchPanelOpen, false);
assert.equal(afterNote.activeProjectId, null);
assert.equal(afterNote.isDirty, false);
assert.equal(afterNote.content, "note body");
assert.deepEqual(afterNote.target, note);

store.syncTitle("Renamed");
assert.equal(useEditorStore.getState().title, "Renamed");
assert.equal(useEditorStore.getState().isDirty, false);

const epoch = useEditorStore.getState().contentEpoch;
store.reset();
assert.equal(useEditorStore.getState().target, null);
assert.equal(useEditorStore.getState().contentEpoch, epoch + 1);

console.info("editor-store: all assertions passed");
