/**
 * Per-project AI prompt template CRUD.
 *
 * Templates are stored as a JSON string on the project record
 * (`aiPromptTemplates`). When no custom templates exist, the client
 * falls back to DEFAULT_TEMPLATES.
 */
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

interface AiPromptTemplate {
  id: string;
  name: string;
  prompt: string;
  position: number;
}

const DEFAULT_TEMPLATES: AiPromptTemplate[] = [
  {
    id: "enhance",
    name: "Enhance",
    prompt: `You are an expert writing editor. Improve the provided markdown content while preserving the author's voice, intent, and meaning.

Guidelines:
- Fix grammar, spelling, and punctuation errors
- Improve sentence structure and flow
- Enhance clarity and readability
- Maintain the original tone and style
- Preserve all markdown formatting (headings, links, lists, code blocks, etc.)
- Do not add new sections or substantially change the content's meaning
- Do not add commentary, explanations, or meta-text
- Return ONLY the improved markdown content, nothing else
- If the content is already well-written, make minimal changes`,
    position: 0,
  },
  {
    id: "inline-transform",
    name: "Inline transform",
    prompt: `You are a writing assistant. Transform the provided text according to the user's instruction.

Rules:
- Apply ONLY the requested transformation
- Return ONLY the transformed text, no commentary or explanation
- Preserve markdown formatting unless the instruction says otherwise
- If the instruction is unclear, make your best interpretation
- Keep the same language unless asked to translate`,
    position: 1,
  },
  {
    id: "final-draft",
    name: "Final draft",
    prompt: `You are an expert long-form blog editor. Turn the provided working article, draft snapshots, and research notes into a polished final markdown draft.

Guidelines:
- Use the research and prior drafts as context, not as text to dump verbatim
- Preserve the author's voice and the article's intended angle
- Resolve contradictions by favoring the current article unless research clearly improves it
- Keep markdown formatting clean and publish-ready
- Do not invent facts beyond the provided context
- Do not include commentary, explanations, or meta-text
- Return ONLY the final markdown article`,
    position: 2,
  },
  {
    id: "simplify",
    name: "Simplify",
    prompt:
      "Simplify this text for a broader audience. Use shorter sentences, simpler words, and clearer structure. Keep the core meaning intact.",
    position: 3,
  },
  {
    id: "make-concise",
    name: "Make concise",
    prompt:
      "Make this text more concise. Remove redundancy, tighten phrasing, and cut filler words while preserving the key points and meaning.",
    position: 4,
  },
  {
    id: "fix-grammar",
    name: "Fix grammar",
    prompt:
      "Fix only grammar, spelling, and punctuation errors. Do not change the style, tone, or wording beyond what is necessary for correctness.",
    position: 5,
  },
];

export const getTemplates = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return DEFAULT_TEMPLATES;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return DEFAULT_TEMPLATES;

    if (!project.aiPromptTemplates) return DEFAULT_TEMPLATES;

    try {
      const templates = JSON.parse(
        project.aiPromptTemplates,
      ) as AiPromptTemplate[];
      return templates.sort((a, b) => a.position - b.position);
    } catch {
      return DEFAULT_TEMPLATES;
    }
  },
});

export const updateTemplates = mutation({
  args: {
    projectId: v.id("projects"),
    templates: v.string(),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "promptTemplates:updateTemplates", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    let templates: AiPromptTemplate[];
    try {
      templates = JSON.parse(args.templates);
    } catch {
      throw new Error("Invalid templates JSON");
    }

    if (!Array.isArray(templates)) {
      throw new Error("Templates must be an array");
    }

    if (templates.length > 20) {
      throw new Error("Maximum 20 templates allowed");
    }

    const ids = new Set<string>();
    for (const t of templates) {
      if (ids.has(t.id)) {
        throw new Error(`Duplicate template ID: "${t.id}"`);
      }
      ids.add(t.id);
    }

    await ctx.db.patch(args.projectId, {
      aiPromptTemplates: args.templates,
      updatedAt: Date.now(),
    });
  },
});

export const addTemplate = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "promptTemplates:addTemplate", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    let templates: AiPromptTemplate[] = DEFAULT_TEMPLATES;
    if (project.aiPromptTemplates) {
      try {
        templates = JSON.parse(project.aiPromptTemplates);
      } catch {
        // Fall through to defaults
      }
    }

    if (templates.length >= 20) {
      throw new Error("Maximum 20 templates reached");
    }

    const baseId = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    let id = baseId || "template";
    let suffix = 1;
    while (templates.some((t) => t.id === id)) {
      id = `${baseId}-${suffix}`;
      suffix++;
    }

    const maxPosition = Math.max(...templates.map((t) => t.position), -1);

    const newTemplate: AiPromptTemplate = {
      id,
      name: args.name,
      prompt: args.prompt,
      position: maxPosition + 1,
    };

    templates.push(newTemplate);

    await ctx.db.patch(args.projectId, {
      aiPromptTemplates: JSON.stringify(templates),
      updatedAt: Date.now(),
    });

    return newTemplate;
  },
});

export const removeTemplate = mutation({
  args: {
    projectId: v.id("projects"),
    templateId: v.string(),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "promptTemplates:removeTemplate", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    let templates: AiPromptTemplate[] = DEFAULT_TEMPLATES;
    if (project.aiPromptTemplates) {
      try {
        templates = JSON.parse(project.aiPromptTemplates);
      } catch {
        // Fall through to defaults
      }
    }

    const idx = templates.findIndex((t) => t.id === args.templateId);
    if (idx === -1) {
      throw new Error(`Template "${args.templateId}" not found`);
    }

    templates.splice(idx, 1);

    await ctx.db.patch(args.projectId, {
      aiPromptTemplates: JSON.stringify(templates),
      updatedAt: Date.now(),
    });
  },
});
