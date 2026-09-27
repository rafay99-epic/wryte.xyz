import type { FunctionReturnType } from "convex/server";
import {
  defineMcpResource,
  defineMcpResourceTemplate,
  type McpResourceRegistration,
  type McpResourceTemplateProvider,
} from "convex-mcp-gateway";
import { api, internal } from "../_generated/api";

const JSON_MIME = "application/json";

function jsonPart(uri: string, data: unknown) {
  return [{ uri, mimeType: JSON_MIME, text: JSON.stringify(data, null, 2) }];
}

export const resources: McpResourceRegistration[] = [
  defineMcpResource({
    uri: "wryte://projects",
    name: "wryte-projects",
    title: "Projects",
    description:
      "Index of the caller's writing projects: id, name, slug, repo, media storage mode.",
    mimeType: JSON_MIME,
    read: async (ctx, { uri, identity }) => {
      const projects: FunctionReturnType<
        typeof internal.mcp.handlers.projects.list
      > = await ctx.runQuery(internal.mcp.handlers.projects.list, {
        caller: { subject: identity.subject },
      });
      return jsonPart(uri, projects);
    },
  }),
];

export const resourceTemplates: McpResourceTemplateProvider[] = [
  defineMcpResourceTemplate({
    uriTemplate: "wryte://project/{projectId}/frontmatter-schema",
    name: "wryte-frontmatter-schema",
    title: "Project frontmatter schema",
    description:
      "The frontmatter contract for a project. Read this before creating or updating a document.",
    mimeType: JSON_MIME,
    read: async (ctx, { uri, params, identity }) => {
      const projectId = params["projectId"];
      if (!projectId) return null;
      const project: FunctionReturnType<
        typeof internal.mcp.handlers.resources.project
      > = await ctx.runQuery(internal.mcp.handlers.resources.project, {
        caller: { subject: identity.subject },
        projectId,
      });
      if (!project) return null;

      type SchemaField = {
        name: string;
        type: string;
        required: boolean;
        defaultValue: string;
        options: string;
        description?: string;
        hidden?: boolean;
      };

      let fields: SchemaField[] = [];
      let parseError: string | null = null;
      if (project.frontmatterSchema) {
        try {
          const parsed: unknown = JSON.parse(project.frontmatterSchema);
          if (Array.isArray(parsed)) fields = parsed as SchemaField[];
        } catch (e) {
          parseError = e instanceof Error ? e.message : String(e);
        }
      }

      const requiredFields = fields
        .filter((f) => f.required && !f.hidden)
        .map((f) => f.name);

      const defaults: Record<string, string> = {};
      for (const field of fields) {
        if (field.defaultValue) {
          defaults[field.name] = field.defaultValue;
        } else if (field.type === "date" || field.type === "datetime") {
          defaults[field.name] =
            field.type === "date"
              ? "today's date (YYYY-MM-DD)"
              : "today's date-time (ISO 8601)";
        }
      }

      return jsonPart(uri, {
        projectId: project._id,
        frontmatterSchema: project.frontmatterSchema ?? null,
        fields,
        requiredFields,
        defaults,
        contentPath: project.contentPath ?? null,
        note: fields.length
          ? "Frontmatter must include every required field. Build it as a YAML/JSON object keyed by field name and pass it as the `frontmatter` string on create/update."
          : parseError
            ? `No usable schema — the stored schema failed to parse (${parseError}). Frontmatter is free-form for this project.`
            : "No schema configured — frontmatter is free-form for this project.",
      });
    },
  }),

  defineMcpResourceTemplate({
    uriTemplate: "wryte://project/{projectId}/board-columns",
    name: "wryte-board-columns",
    title: "Project board columns",
    description:
      "Valid status values for a project, in board order. Use these as the status in wryte_documents_update.",
    mimeType: JSON_MIME,
    read: async (ctx, { uri, params }) => {
      const projectId = params["projectId"];
      if (!projectId) return null;
      const columns: FunctionReturnType<
        typeof api.cms.boardColumns.getColumns
      > = await ctx.runQuery(api.cms.boardColumns.getColumns, { projectId });
      return jsonPart(uri, { projectId, columns });
    },
  }),

  defineMcpResourceTemplate({
    uriTemplate: "wryte://document/{documentId}",
    name: "wryte-document",
    title: "Document",
    description: "A document's frontmatter, body and tags.",
    mimeType: JSON_MIME,
    read: async (ctx, { uri, params, identity }) => {
      const documentId = params["documentId"];
      if (!documentId) return null;
      const doc: FunctionReturnType<
        typeof internal.mcp.handlers.resources.document
      > = await ctx.runQuery(internal.mcp.handlers.resources.document, {
        caller: { subject: identity.subject },
        documentId,
      });
      if (!doc) return null;
      return jsonPart(uri, {
        documentId: doc._id,
        projectId: doc.projectId,
        title: doc.title,
        slug: doc.slug,
        status: doc.status,
        tags: doc.tags ?? [],
        frontmatter: doc.frontmatter ?? null,
        content: doc.content ?? "",
        updatedAt: doc.updatedAt,
      });
    },
  }),
];
