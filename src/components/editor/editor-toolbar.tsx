"use client";

import {
  Bold,
  Braces,
  Calendar,
  Code,
  Heading,
  ImagePlus,
  Italic,
  Link,
  List,
  ListOrdered,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorStore } from "@/stores/editor-store";
import { useShallow } from "zustand/react/shallow";
import { AiEnhanceButton } from "./ai-enhance-button";
import { useEditorContext } from "./editor-context";
import { ImageInsertDialog } from "./image-insert-dialog";
import { PublishDialog } from "./publish-dialog";
import { ScheduleDialog } from "./schedule-dialog";

interface EditorToolbarProps {
  documentId: string;
  projectId: string;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function EditorToolbar({ documentId, projectId }: EditorToolbarProps) {
  const { viewMode, setViewMode, isSaving, isDirty, lastSavedAt } =
    useEditorStore(
      useShallow((state) => ({
        viewMode: state.viewMode,
        setViewMode: state.setViewMode,
        isSaving: state.isSaving,
        isDirty: state.isDirty,
        lastSavedAt: state.lastSavedAt,
      })),
    );
  const { insertAtCursor, wrapSelection } = useEditorContext();

  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  function handleBold() {
    wrapSelection("**", "**");
  }

  function handleItalic() {
    wrapSelection("*", "*");
  }

  function handleLink() {
    wrapSelection("[", "](url)");
  }

  function handleInlineCode() {
    wrapSelection("`", "`");
  }

  function handleCodeBlock() {
    insertAtCursor("\n```\n\n```\n");
  }

  function handleList() {
    insertAtCursor("\n- ");
  }

  function handleOrderedList() {
    insertAtCursor("\n1. ");
  }

  function handleHeading(level: number) {
    const prefix = "#".repeat(level);
    insertAtCursor(`\n${prefix} `);
  }

  function handleImageInsert(markdown: string) {
    insertAtCursor(markdown);
  }

  return (
    <>
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        {/* Left section - formatting buttons */}
        <TooltipProvider>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="ghost" size="icon-sm" onClick={handleBold} />
                }
              >
                <Bold />
              </TooltipTrigger>
              <TooltipContent>Bold (Ctrl+B)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleItalic}
                  />
                }
              >
                <Italic />
              </TooltipTrigger>
              <TooltipContent>Italic (Ctrl+I)</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon-sm" />}
                    >
                      <Heading />
                    </DropdownMenuTrigger>
                  }
                />
                <TooltipContent>Heading</TooltipContent>
              </Tooltip>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleHeading(1)}>
                  <span className="text-lg font-bold">H1</span>
                  <span className="ml-2 text-muted-foreground">Heading 1</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleHeading(2)}>
                  <span className="text-base font-bold">H2</span>
                  <span className="ml-2 text-muted-foreground">Heading 2</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleHeading(3)}>
                  <span className="text-sm font-bold">H3</span>
                  <span className="ml-2 text-muted-foreground">Heading 3</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="ghost" size="icon-sm" onClick={handleLink} />
                }
              >
                <Link />
              </TooltipTrigger>
              <TooltipContent>Link (Ctrl+K)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setImageDialogOpen(true)}
                  />
                }
              >
                <ImagePlus />
              </TooltipTrigger>
              <TooltipContent>Insert image</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleInlineCode}
                  />
                }
              >
                <Code />
              </TooltipTrigger>
              <TooltipContent>Inline code</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleCodeBlock}
                  />
                }
              >
                <Braces />
              </TooltipTrigger>
              <TooltipContent>Code block (Ctrl+Shift+K)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="ghost" size="icon-sm" onClick={handleList} />
                }
              >
                <List />
              </TooltipTrigger>
              <TooltipContent>Bullet list</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleOrderedList}
                  />
                }
              >
                <ListOrdered />
              </TooltipTrigger>
              <TooltipContent>Ordered list</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-primary"
          onClick={() => setAiDialogOpen(true)}
        >
          <Sparkles className="size-3.5" />
          Enhance with AI
        </Button>

        {/* Middle section - view mode toggle */}
        <div className="ml-auto flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          <Button
            variant={viewMode === "edit" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setViewMode("edit")}
          >
            Edit
          </Button>
          <Button
            variant={viewMode === "split" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setViewMode("split")}
          >
            Split
          </Button>
          <Button
            variant={viewMode === "preview" ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setViewMode("preview")}
          >
            Preview
          </Button>
        </div>

        {/* Right section - save status, schedule, publish */}
        <Separator orientation="vertical" className="mx-1 h-5" />

        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {isSaving ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Saving...
              </>
            ) : isDirty ? (
              "Unsaved changes"
            ) : lastSavedAt ? (
              `Saved at ${formatTime(lastSavedAt)}`
            ) : (
              ""
            )}
          </span>

          <Separator orientation="vertical" className="mx-0.5 h-5" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setScheduleDialogOpen(true)}
                  />
                }
              >
                <Calendar />
              </TooltipTrigger>
              <TooltipContent>Schedule</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setPublishDialogOpen(true)}
          >
            <Send className="size-3.5" />
            Publish
          </Button>
        </div>
      </div>

      <ImageInsertDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        onInsert={handleImageInsert}
        projectId={projectId}
      />

      <PublishDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        documentId={documentId}
        projectId={projectId}
      />

      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        documentId={documentId}
      />

      <AiEnhanceButton open={aiDialogOpen} onOpenChange={setAiDialogOpen} />
    </>
  );
}
