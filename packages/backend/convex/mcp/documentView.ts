import type { Doc } from "../_generated/dataModel";

export function agentDocumentView(document: Doc<"documents">) {
  return {
    documentId: document._id,
    projectId: document.projectId,
    title: document.title,
    slug: document.slug,
    status: document.status,
    tags: document.tags ?? [],
    frontmatter: document.frontmatter ?? null,
    mainWordCount: document.wordCount ?? 0,
    scheduledAt: document.scheduledAt ?? null,
    publishedAt: document.publishedAt ?? null,
    updatedAt: document.updatedAt,
  };
}
