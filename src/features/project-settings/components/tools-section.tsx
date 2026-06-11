"use client";

import { useAction, useConvex } from "convex/react";
import { strToU8, zipSync } from "fflate";
import { motion } from "framer-motion";
import yaml from "js-yaml";
import {
  Download,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { ProjectData } from "../types";
import { SectionHeader } from "./shared";

export function ToolsSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={Wrench}
        title="Tools"
        description="One-off utilities for this project — run them when you need them."
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-6"
      >
        <ExportTool projectId={projectId} projectSlug={project.slug} />
        <div className="border-t border-border/40 pt-6">
          <LinkCheckerTool projectId={projectId} />
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Export ──────────────────────────────────────────────────────────── */

type ExportPage = {
  page: {
    _id: string;
    title: string;
    slug: string;
    status: string;
    content: string;
    frontmatter: string | null;
    updatedAt: number;
  }[];
  isDone: boolean;
  continueCursor: string;
};

function ExportTool({
  projectId,
  projectSlug,
}: {
  projectId: Id<"projects">;
  projectSlug: string;
}) {
  const convex = useConvex();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleExport() {
    setIsExporting(true);
    setProgress(0);
    try {
      // Walk the export feed page by page with one-shot queries — no
      // subscription, nothing reactive, only paid on click.
      const files: Record<string, Uint8Array> = {};
      const usedNames = new Set<string>();
      let cursor: string | null = null;
      let count = 0;

      for (;;) {
        // Explicit annotation breaks the cursor → result type circularity.
        const result: ExportPage = await convex.query(
          api.cms.documents.listForExport,
          { projectId, paginationOpts: { numItems: 50, cursor } },
        );

        for (const doc of result.page) {
          let frontmatter: Record<string, unknown> = {};
          if (doc.frontmatter) {
            try {
              frontmatter = JSON.parse(doc.frontmatter) as Record<
                string,
                unknown
              >;
            } catch {
              // Unparseable frontmatter — export the body alone.
            }
          }
          const yamlBlock =
            Object.keys(frontmatter).length > 0
              ? `---\n${yaml.dump(frontmatter)}---\n\n`
              : "";

          let name = `${doc.slug || doc._id}.md`;
          let suffix = 2;
          while (usedNames.has(name)) {
            name = `${doc.slug || doc._id}-${suffix++}.md`;
          }
          usedNames.add(name);
          files[name] = strToU8(`${yamlBlock}${doc.content}`);
          count++;
        }
        setProgress(count);

        if (result.isDone) break;
        cursor = result.continueCursor;
      }

      if (count === 0) {
        toast.info("Nothing to export", {
          description: "This project has no documents yet.",
        });
        return;
      }

      const zipped = zipSync(files);
      const blob = new Blob([zipped as unknown as BlobPart], {
        type: "application/zip",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${projectSlug || "project"}-export.zip`;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${count} article${count === 1 ? "" : "s"}`);
    } catch {
      toast.error("Export failed", {
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div>
      <div className="mb-3">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <FileText className="size-3.5 text-muted-foreground" />
          Export project
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Download every article as a markdown file with YAML frontmatter,
          zipped. Your content is never locked in.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void handleExport()}
        disabled={isExporting}
        className="gap-1.5"
      >
        {isExporting ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Exporting… {progress > 0 && `${progress} articles`}
          </>
        ) : (
          <>
            <Download className="size-3.5" />
            Export all articles
          </>
        )}
      </Button>
    </div>
  );
}

/* ── Link checker ────────────────────────────────────────────────────── */

type LinkCheckResult = {
  documentsScanned: number;
  totalLinks: number;
  checked: number;
  truncated: number;
  broken: {
    url: string;
    reason: string;
    documents: { id: string; title: string }[];
  }[];
};

function LinkCheckerTool({ projectId }: { projectId: Id<"projects"> }) {
  const runLinkCheck = useAction(api.integrations.linkCheck.run);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<LinkCheckResult | null>(null);

  async function handleCheck() {
    setIsChecking(true);
    setResult(null);
    try {
      const res = await runLinkCheck({ projectId });
      setResult(res);
      if (res.broken.length === 0) {
        toast.success("All links look healthy", {
          description: `Checked ${res.checked} links across ${res.documentsScanned} articles.`,
        });
      }
    } catch (err) {
      toast.error("Link check failed", {
        description:
          err instanceof Error && err.message.includes("rate")
            ? "You've run this a few times recently — try again in a bit."
            : "Something went wrong. Please try again.",
      });
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div>
      <div className="mb-3">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="size-3.5 text-muted-foreground" />
          Link checker
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Probes every external link in this project's articles and reports the
          dead ones. Runs only when you ask — never in the background.
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => void handleCheck()}
        disabled={isChecking}
        className="gap-1.5"
      >
        {isChecking ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Checking links…
          </>
        ) : (
          <>
            <Link2 className="size-3.5" />
            Check links
          </>
        )}
      </Button>

      {result && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Checked{" "}
            <span className="font-medium tabular-nums text-foreground">
              {result.checked}
            </span>{" "}
            links across {result.documentsScanned} articles —{" "}
            {result.broken.length === 0 ? (
              <span className="font-medium text-emerald-600">all healthy</span>
            ) : (
              <span className="font-medium text-red-500">
                {result.broken.length} broken
              </span>
            )}
            {result.truncated > 0 &&
              ` (${result.truncated} links skipped — over the per-run cap)`}
            .
          </p>

          {result.broken.map((link) => (
            <div
              key={link.url}
              className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 break-all font-mono text-[11px] text-foreground/80 hover:underline"
                >
                  {link.url}
                </a>
                <span className="shrink-0 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
                  {link.reason}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {link.documents.map((doc) => (
                  <Link
                    key={`${link.url}-${doc.id}`}
                    href={`/editor/${doc.id}`}
                    className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-2.5" />
                    {doc.title || "Untitled"}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
