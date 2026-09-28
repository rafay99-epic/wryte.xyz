import type { FunctionReturnType } from "convex/server";
import {
  defineMcpResource,
  defineMcpResourceTemplate,
  type McpResourceRegistration,
  type McpResourceTemplateProvider,
} from "convex-mcp-gateway";
import { internal } from "../_generated/api";

const JSON_MIME = "application/json";

type ProjectContext = FunctionReturnType<
  typeof internal.mcp.handlers.resources.project
>;

function jsonPart(uri: string, data: unknown) {
  return [{ uri, mimeType: JSON_MIME, text: JSON.stringify(data, null, 2) }];
}

export const resources: McpResourceRegistration[] = [
  defineMcpResource({
    uri: "wryte://projects",
    name: "wryte-projects",
    title: "Projects",
    description:
      "Index of the caller's writing projects: id, name, slug, repo, content format, media storage mode.",
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
      "The frontmatter contract for a project. Same data as wryte_project_context.",
    mimeType: JSON_MIME,
    read: async (ctx, { uri, params, identity }) => {
      const projectId = params["projectId"];
      if (!projectId) return null;
      const context: ProjectContext = await ctx.runQuery(
        internal.mcp.handlers.resources.project,
        { caller: { subject: identity.subject }, projectId },
      );
      if (!context) return null;
      return jsonPart(uri, {
        projectId: context.projectId,
        contentPath: context.content.path,
        ...context.frontmatter,
      });
    },
  }),

  defineMcpResourceTemplate({
    uriTemplate: "wryte://project/{projectId}/board-columns",
    name: "wryte-board-columns",
    title: "Project board columns",
    description:
      "Statuses an agent may set, in board order. Scheduling and publishing columns are left out.",
    mimeType: JSON_MIME,
    read: async (ctx, { uri, params, identity }) => {
      const projectId = params["projectId"];
      if (!projectId) return null;
      const context: ProjectContext = await ctx.runQuery(
        internal.mcp.handlers.resources.project,
        { caller: { subject: identity.subject }, projectId },
      );
      if (!context) return null;
      return jsonPart(uri, { projectId, columns: context.statuses });
    },
  }),

  defineMcpResourceTemplate({
    uriTemplate: "wryte://document/{documentId}",
    name: "wryte-document",
    title: "Document",
    description:
      "A post's title, slug, status, tags and frontmatter. The Main body is never exposed.",
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
      return doc ? jsonPart(uri, doc) : null;
    },
  }),
];
