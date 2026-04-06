"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEditorStore } from "@/stores/editor-store";
import { useShallow } from "zustand/react/shallow";

interface AiEnhanceButtonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Placeholder AI enhancement function.
 * In production, this would call an AI API to improve the content.
 */
async function enhanceContent(content: string): Promise<string> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  let enhanced = content;

  // Add a heading if the content doesn't start with one
  if (!enhanced.startsWith("#")) {
    const firstLine = enhanced.split("\n")[0] ?? "";
    if (firstLine.length > 0 && firstLine.length < 80) {
      enhanced = `# ${firstLine}\n\n${enhanced.split("\n").slice(1).join("\n")}`;
    }
  }

  // Add a note that AI enhancement was applied
  enhanced = `<!-- AI Enhanced -->\n${enhanced}`;

  return enhanced;
}

/**
 * Placeholder dialog for the AI content enhancement feature.
 * Shows a preview of the current content and a button to trigger enhancement.
 * Currently uses a stub `enhanceContent` function that simulates AI processing
 * with a delay and basic formatting tweaks. In production, this would call
 * an AI API endpoint. The enhancement result replaces the editor content
 * via the Zustand store, and can be undone with Ctrl+Z.
 */
export function AiEnhanceButton({ open, onOpenChange }: AiEnhanceButtonProps) {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const { content, setContent } = useEditorStore(
    useShallow((state) => ({
      content: state.content,
      setContent: state.setContent,
    })),
  );

  const contentPreview =
    content.length > 300 ? `${content.slice(0, 300)}...` : content;

  async function handleEnhance() {
    setIsEnhancing(true);
    try {
      const enhanced = await enhanceContent(content);
      setContent(enhanced);
      onOpenChange(false);
    } finally {
      setIsEnhancing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI Enhancement
          </DialogTitle>
          <DialogDescription>
            Let AI improve your content&apos;s formatting and structure.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Badge variant="secondary">AI Enhancement is in preview</Badge>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Current content
            </p>
            <div className="max-h-48 overflow-y-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">
              {contentPreview || "No content to enhance."}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            The AI will analyze your content and improve formatting, add missing
            headings, and clean up structure. This action can be undone with
            Ctrl+Z.
          </p>
        </div>

        <DialogFooter>
          <Button
            onClick={() => void handleEnhance()}
            disabled={isEnhancing || !content}
          >
            {isEnhancing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Enhancing...
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                Enhance
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
