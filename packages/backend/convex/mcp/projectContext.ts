import type { Doc } from "../_generated/dataModel";
import {
  ANIMATION_RULES,
  resolveAnimationLanguage,
} from "../_lib/animationChecks";
import { projectUploadLimit, QUOTAS } from "../_lib/quotas";
import { boardColumnsForProject } from "../cms/boardColumns";
import { resolveDefaultProvider } from "../media/_lib/providers";
import { frontmatterContract } from "./frontmatterSchema";

export function agentStatuses(project: Pick<Doc<"projects">, "boardColumns">) {
  return boardColumnsForProject(project)
    .filter((column) => column.behavior === "none")
    .map(({ id, label }) => ({ id, label }));
}

export function assertAgentStatus(
  project: Pick<Doc<"projects">, "boardColumns">,
  status: string,
): void {
  if (agentStatuses(project).some((column) => column.id === status)) return;
  throw new Error(
    `Status "${status}" can't be set over MCP. Use one of the statuses from wryte_project_context; scheduling and publishing stay with the user.`,
  );
}

export function animationsEnabled(
  project: Pick<Doc<"projects">, "animationsEnabled" | "animationsPath">,
): boolean {
  return project.animationsEnabled !== false && Boolean(project.animationsPath);
}

export function projectContext(project: Doc<"projects">) {
  const format = project.contentFormat === "mdx" ? "mdx" : "md";
  const enabled = animationsEnabled(project);

  return {
    projectId: project._id,
    name: project.name,
    content: { format, path: project.contentPath ?? null },
    frontmatter: frontmatterContract(project.frontmatterSchema),
    statuses: agentStatuses(project),
    animations: {
      enabled,
      language: resolveAnimationLanguage(project.animationLanguage),
      path: project.animationsPath ?? null,
      checks: project.animationChecks ?? { level: "off", blockPublish: true },
      embed:
        enabled && format === "mdx"
          ? "Put <Name /> on its own line in a draft body. Wryte adds the import on publish."
          : "Animations can't be embedded: the project needs animations enabled and mdx content.",
      rules: ANIMATION_RULES,
    },
    media: {
      provider: resolveDefaultProvider(project.mediaStorageMode),
      maxBytes: projectUploadLimit(project),
      mimeTypes: QUOTAS.ALLOWED_MIME,
    },
  };
}
