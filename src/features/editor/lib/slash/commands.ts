import {
  Braces,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Library,
  Link as LinkIcon,
  List,
  ListOrdered,
  type LucideIcon,
  Minus,
  Quote,
  Sparkles,
  Table,
} from "lucide-react";
import type { Snippet } from "@/types/snippets";

/**
 * Slash-command registry (pure data). `block` commands insert a line-level
 * marker (a leading newline is added by the menu when not already at line
 * start); `inline` inserts at the caret; `ai` opens the existing inline-AI
 * flow at the caret instead of inserting text; `snippet` pastes a reusable
 * block (treated like `block` for newline handling); `submenu` drills into a
 * nested list instead of inserting anything.
 */

export type SlashCommandKind =
  | "block"
  | "inline"
  | "ai"
  | "snippet"
  | "submenu";

export type SlashCommand = {
  id: string;
  label: string;
  hint?: string;
  keywords: string[];
  icon: LucideIcon;
  kind: SlashCommandKind;
  /** Text inserted for `block`/`inline`/`snippet` commands. */
  insert?: string;
};

/**
 * The `Snippets ▸` parent entry shown at the slash-menu root. Selecting it
 * drills into the project's snippets (see slash-menu.tsx). Only appended when
 * the project actually has snippets — the menu owns that gating.
 */
export const SNIPPETS_SUBMENU: SlashCommand = {
  id: "snippets",
  label: "Snippets",
  hint: "▸",
  keywords: ["snippet", "snippets", "reusable", "template"],
  icon: Library,
  kind: "submenu",
};

/** Maps project snippets (from the search query) into insertable commands. */
export function snippetCommands(snippets: Snippet[]): SlashCommand[] {
  return snippets.map((s) => ({
    id: `snippet:${s._id}`,
    label: s.name,
    hint: "Snippet",
    keywords: [s.name.toLowerCase(), "snippet"],
    icon: FileText,
    kind: "snippet" as const,
    insert: s.content,
  }));
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "h1",
    label: "Heading 1",
    keywords: ["heading", "h1", "title", "#"],
    icon: Heading1,
    kind: "block",
    insert: "# ",
  },
  {
    id: "h2",
    label: "Heading 2",
    keywords: ["heading", "h2", "subtitle", "##"],
    icon: Heading2,
    kind: "block",
    insert: "## ",
  },
  {
    id: "h3",
    label: "Heading 3",
    keywords: ["heading", "h3", "###"],
    icon: Heading3,
    kind: "block",
    insert: "### ",
  },
  {
    id: "bullet",
    label: "Bullet list",
    keywords: ["list", "bullet", "unordered", "ul", "-"],
    icon: List,
    kind: "block",
    insert: "- ",
  },
  {
    id: "numbered",
    label: "Numbered list",
    keywords: ["list", "numbered", "ordered", "ol", "1."],
    icon: ListOrdered,
    kind: "block",
    insert: "1. ",
  },
  {
    id: "quote",
    label: "Quote",
    keywords: ["quote", "blockquote", ">"],
    icon: Quote,
    kind: "block",
    insert: "> ",
  },
  {
    id: "code",
    label: "Code block",
    keywords: ["code", "codeblock", "fenced", "```"],
    icon: Braces,
    kind: "block",
    insert: "```\n\n```\n",
  },
  {
    id: "divider",
    label: "Divider",
    keywords: ["divider", "rule", "hr", "separator", "---"],
    icon: Minus,
    kind: "block",
    insert: "---\n",
  },
  {
    id: "table",
    label: "Table",
    keywords: ["table", "grid"],
    icon: Table,
    kind: "block",
    insert: "| Column | Column |\n| --- | --- |\n|  |  |\n",
  },
  {
    id: "link",
    label: "Link",
    keywords: ["link", "url", "href"],
    icon: LinkIcon,
    kind: "inline",
    insert: "[text](url)",
  },
  {
    id: "ai",
    label: "Ask AI to write…",
    hint: "Generate text at the cursor",
    keywords: ["ai", "write", "generate", "assistant"],
    icon: Sparkles,
    kind: "ai",
  },
];

/** Filter by label + keywords. Empty query returns all. */
export function filterCommands(
  commands: SlashCommand[],
  query: string,
): SlashCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  return commands.filter(
    (c) =>
      c.label.toLowerCase().includes(q) ||
      c.keywords.some((k) => k.includes(q)),
  );
}
