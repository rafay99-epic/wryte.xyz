/**
 * MCP resources — read-only context an agent should load *before* acting.
 *
 * Tools are verbs; resources are the shape of the world. Each one here exists
 * to remove a class of repeated tool call, which makes them a cost reduction
 * rather than an ergonomic nicety:
 *
 *   - Without `wryte://projects`, an agent re-lists projects every turn to
 *     remember which id is which.
 *   - Without the frontmatter schema, it guesses the frontmatter, gets
 *     rejected, and retries — three tool calls where zero were needed.
 *   - Without board columns, it invents statuses like "in progress" when the
 *     project's board says "wip".
 *
 * Read handlers run host-side, so `ctx.runQuery` works and the underlying
 * queries apply their own ownership checks. The gateway rejects anonymous
 * resource reads before a handler runs.
 */
import {
  defineMcpResource,
  defineMcpResourceTemplate,
  type McpResourceRegistration,
  type McpResourceTemplateProvider,
} from "convex-mcp-gateway";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";

const JSON_MIME = "application/json";

/** Uniform JSON body helper — every resource returns a single JSON part. */
function jsonPart(uri: string, data: unknown) {
  return [{ uri, mimeType: JSON_MIME, text: JSON.stringify(data, null, 2) }];
}

// Annotated for the same reason as `tools` in `./tools.ts`: `api`'s generated
// type covers this module, so an inferred export type would be circular.
export const resources: McpResourceRegistration[] = [
  /**
   * The agent's map. Projected down to the fields an agent actually reasons
   * about — the full project row also carries frontmatter schemas, retention
   * settings and provider config, none of which belong in a context window.
   */
  defineMcpResource({
    uri: "wryte://projects",
    name: "wryte-projects",
    title: "Projects",
    description:
      "Index of the caller's writing projects: id, name, slug, repo, media storage mode.",
    mimeType: JSON_MIME,
    read: async (ctx, { uri }) => {
      const projects: Doc<"projects">[] = await ctx.runQuery(
        api.cms.projects.list,
        {},
      );
      return jsonPart(
        uri,
        projects.map((project) => ({
          projectId: project._id,
          name: project.name,
          slug: project.slug,
          githubRepo: project.githubRepo ?? null,
          githubBranch: project.githubBranch ?? null,
          contentPath: project.contentPath ?? null,
          mediaStorageMode: project.mediaStorageMode ?? "github",
        })),
      );
    },
  }),
];

export const resourceTemplates: McpResourceTemplateProvider[] = [
  /**
   * The formatter. A project can define a frontmatter schema, and a document
   * whose frontmatter doesn't match it is rejected on write. Exposing the
   * schema means the model writes valid frontmatter the first time instead of
   * discovering the rules through failed mutations.
   *
   * The schema is stored on the project row as a JSON string of
   * `FrontmatterField[]` (see `@wryte/logic/types/frontmatter` — the backend
   * cannot import that package, so the minimal shape is restated here). It is
   * parsed before returning: an agent that has to parse a JSON-in-JSON string
   * tends to skip the resource entirely and guess the frontmatter, which is
   * exactly the failure this resource exists to prevent.
   */
  defineMcpResourceTemplate({
    uriTemplate: "wryte://project/{projectId}/frontmatter-schema",
    name: "wryte-frontmatter-schema",
    title: "Project frontmatter schema",
    description:
      "The frontmatter contract for a project. Read this before creating or updating a document.",
    mimeType: JSON_MIME,
    read: async (ctx, { uri, params }) => {
      const projectId = params["projectId"] as Id<"projects"> | undefined;
      if (!projectId) return null;
      const project = await ctx.runQuery(api.cms.projects.get, { projectId });
      if (!project) return null;

      // Minimal mirror of `FrontmatterField` — only what an agent needs.
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

      // Per-field fill guidance. `defaultValue` is the field's configured
      // pre-populated value; empty defaults for date/datetime fields mean
      // "use today's date". Everything else empty means the agent invents
      // the value from the document content.
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
        // Raw string preserved for clients that want the exact contract.
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

  /**
   * Valid board statuses. `wryte_documents_set_status` takes a free string,
   * and the set of legal values is per-project, so without this an agent is
   * guessing.
   */
  defineMcpResourceTemplate({
    uriTemplate: "wryte://project/{projectId}/board-columns",
    name: "wryte-board-columns",
    title: "Project board columns",
    description:
      "Valid status values for a project, in board order. Use these with wryte_documents_set_status.",
    mimeType: JSON_MIME,
    read: async (ctx, { uri, params }) => {
      const projectId = params["projectId"] as Id<"projects"> | undefined;
      if (!projectId) return null;
      const columns = await ctx.runQuery(api.cms.boardColumns.getColumns, {
        projectId,
      });
      return jsonPart(uri, { projectId, columns });
    },
  }),

  /**
   * A document as attachable context, so a client can pull one into the
   * conversation without spending a tool call on it.
   */
  defineMcpResourceTemplate({
    uriTemplate: "wryte://document/{documentId}",
    name: "wryte-document",
    title: "Document",
    description: "A document's frontmatter, body and tags.",
    mimeType: JSON_MIME,
    read: async (ctx, { uri, params }) => {
      const documentId = params["documentId"] as Id<"documents"> | undefined;
      if (!documentId) return null;
      const doc = await ctx.runQuery(api.cms.documents.get, { documentId });
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
