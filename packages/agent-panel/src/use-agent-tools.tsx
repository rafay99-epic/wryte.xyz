"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useConvex } from "convex/react";
import { useEffect, useRef } from "react";
import { useDesktopAgents } from "./desktop-agents";

/**
 * Executes agent tool calls against Convex.
 *
 * Main can't do this itself: Convex auth is a Clerk JWT held by the renderer.
 * So main proxies every tool call here, this runs it with the session the user
 * is already signed into, and the result travels back. The agent never sees a
 * credential and can never reach anything the user couldn't.
 */
export function useAgentTools({
  documentId,
  onToolResult,
}: {
  documentId?: string | undefined;
  onToolResult?: ((name: string, summary: string) => void) | undefined;
}) {
  const agents = useDesktopAgents();
  const convex = useConvex();

  // Read through a ref so the IPC subscription is registered once and never
  // rebinds mid-turn as the editor buffer changes underneath it.
  const stateRef = useRef({ documentId, onToolResult });
  stateRef.current = { documentId, onToolResult };

  useEffect(() => {
    if (!agents?.onToolCall) return;

    return agents.onToolCall(async (name, args) => {
      const { documentId: id, onToolResult: report } = stateRef.current;
      if (!id) throw new Error("No document is open in the editor");
      const docId = id as Id<"documents">;

      switch (name) {
        case "get_document": {
          const doc = await convex.query(api.cms.documents.get, {
            documentId: docId,
          });
          if (!doc) throw new Error("Document not found");
          report?.(name, "read the open document");
          return {
            title: doc.title,
            slug: doc.slug,
            status: doc.status,
            frontmatter: doc.frontmatter ?? null,
            content: doc.content ?? "",
          };
        }

        case "update_document": {
          const content = String(args["content"] ?? "");
          if (!content.trim())
            throw new Error("Refusing to write empty content");

          // Land it in the editor buffer rather than writing Convex directly:
          // the user sees the change immediately, and the existing autosave
          // owns persistence. Same path AI enhance already uses.
          useEditorStore.getState().setContent(content);

          const summary = String(args["summary"] ?? "updated the document");
          report?.(name, summary);
          return {
            ok: true,
            appliedTo: "editor",
            note: "Visible to the user now; autosave will persist it.",
          };
        }

        case "create_draft": {
          const draftId = await convex.mutation(api.cms.documentDrafts.create, {
            documentId: docId,
            label: String(args["label"] ?? "Agent draft"),
            copyFromMain: args["copyFromMain"] === true,
          });
          report?.(name, `created draft "${args["label"]}"`);
          return { draftId };
        }

        case "add_research": {
          const researchId = await convex.mutation(
            api.cms.documentResearch.create,
            {
              documentId: docId,
              type: args["type"] as
                | "note"
                | "source"
                | "quote"
                | "outline"
                | "idea"
                | "ai_summary",
              title: String(args["title"] ?? "Untitled"),
              content: String(args["content"] ?? ""),
              ...(args["url"] ? { url: String(args["url"]) } : {}),
              ...(args["sourceName"]
                ? { sourceName: String(args["sourceName"]) }
                : {}),
            },
          );
          report?.(name, `filed research: ${args["title"]}`);
          return { researchId };
        }

        case "search_documents": {
          const projectId = useEditorStore.getState().activeProjectId;
          if (!projectId) throw new Error("No active project");
          const results = await convex.query(api.cms.documents.searchForLink, {
            projectId: projectId as Id<"projects">,
            term: String(args["term"] ?? ""),
          });
          report?.(name, `searched for "${args["term"]}"`);
          return results;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }, [agents, convex]);
}
