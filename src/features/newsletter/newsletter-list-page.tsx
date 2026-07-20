"use client";

import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/settings/confirm-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatPill } from "@/features/dashboard/components/stat-pill";
import {
  fadeSlideUp,
  smoothTransition,
  staggerContainer,
  staggerItem,
} from "@/lib/motion";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type NewsletterStatus = "draft" | "scheduled" | "sent" | "failed";
type TabFilter = "all" | "draft" | "scheduled" | "sent";

const STATUS_CONFIG: Record<
  NewsletterStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground",
    icon: null,
  },
  scheduled: {
    label: "Scheduled",
    className:
      "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    icon: <Clock className="size-3" />,
  },
  sent: {
    label: "Sent",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    icon: <CheckCircle2 className="size-3" />,
  },
  failed: {
    label: "Failed",
    className:
      "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400",
    icon: <AlertTriangle className="size-3" />,
  },
};

function NewsletterStatusBadge({ status }: { status: NewsletterStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="secondary" className={cn("shrink-0", config.className)}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

/** Client-generated, url-safe — the id must never appear in the URL. */
function randomSlug(): string {
  return `nl-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

export function NewsletterListPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;
  const router = useRouter();

  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(projectId);
  }, [projectId]);

  const connection = useQuery(api.newsletter.connections.get, { projectId });
  const newsletters = useQuery(api.newsletter.newsletters.list, {
    projectId,
  });
  const counts = useQuery(api.newsletter.newsletters.counts, { projectId });
  const create = useMutation(api.newsletter.newsletters.create);
  const remove = useMutation(api.newsletter.newsletters.remove);

  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"newsletters">;
    subject: string;
  } | null>(null);

  const isLoading = newsletters === undefined || counts === undefined;
  const totalCount =
    (counts?.draft ?? 0) +
    (counts?.scheduled ?? 0) +
    (counts?.sent ?? 0) +
    (counts?.failed ?? 0);

  const filtered = useMemo(() => {
    if (!newsletters) return undefined;
    if (activeTab === "all") return newsletters;
    return newsletters.filter((n) => n.status === activeTab);
  }, [newsletters, activeTab]);

  const subtitle = useMemo(() => {
    if (!counts) return "";
    if (totalCount === 0) return "No newsletters yet — write your first one.";
    const parts: string[] = [];
    if (counts.sent > 0) parts.push(`${counts.sent} sent`);
    if (counts.scheduled > 0) parts.push(`${counts.scheduled} scheduled`);
    if (counts.draft > 0)
      parts.push(`${counts.draft} draft${counts.draft === 1 ? "" : "s"}`);
    if (counts.failed > 0) parts.push(`${counts.failed} failed`);
    return parts.join(" · ");
  }, [counts, totalCount]);

  async function attemptCreate(): Promise<{ slug: string } | null> {
    try {
      return await create({ projectId, slug: randomSlug() });
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      if (data?.message === "slug-taken") return null;
      throw err;
    }
  }

  async function handleNew() {
    setCreating(true);
    try {
      const res = (await attemptCreate()) ?? (await attemptCreate());
      if (!res) {
        toast.error("Couldn't create newsletter — please try again.");
        setCreating(false);
        return;
      }
      router.push(`/projects/${projectId}/newsletters/${res.slug}`);
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(data?.message ?? "Couldn't create newsletter.");
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await remove({ newsletterId: deleteTarget.id });
      toast.success("Newsletter deleted");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(data?.message ?? "Couldn't delete newsletter.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={smoothTransition}
        className="mb-6 flex items-end justify-between"
      >
        <div>
          {isLoading ? (
            <>
              <Skeleton className="mb-2 h-7 w-40" />
              <Skeleton className="h-4 w-32" />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight">Newsletters</h1>
              <p className="mt-1 text-sm text-muted-foreground/70">
                {subtitle}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}/settings?tab=newsletter`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Settings className="size-3.5" />
            Settings
          </Link>
          <Button
            size="sm"
            onClick={() => void handleNew()}
            disabled={creating}
          >
            {creating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            New newsletter
          </Button>
        </div>
      </motion.div>

      {/* ── Not-connected hint ──────────────────────────────────── */}
      {connection === null && (
        <motion.p
          variants={fadeSlideUp}
          initial="initial"
          animate="animate"
          transition={{ ...smoothTransition, delay: 0.03 }}
          className="mb-6 text-xs text-amber-600 dark:text-amber-400"
        >
          <AlertTriangle className="mr-1 inline size-3 -translate-y-px" />
          No provider connected — you can write, but sending needs a connection
          in{" "}
          <Link
            href={`/projects/${projectId}/settings?tab=newsletter`}
            className="font-medium underline underline-offset-2"
          >
            Settings → Newsletter
          </Link>
          .
        </motion.p>
      )}

      {/* ── Status counts ───────────────────────────────────────── */}
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={{ ...smoothTransition, delay: 0.05 }}
        className="mb-8"
      >
        <div className="flex items-center gap-6 overflow-x-auto rounded-xl border border-border/30 bg-card/50 px-6 py-4">
          <StatPill
            value={counts?.draft ?? 0}
            label="Drafts"
            icon={<FileText className="size-3.5" />}
            loading={isLoading}
          />
          <div className="h-8 w-px shrink-0 bg-border/30" />
          <StatPill
            value={counts?.scheduled ?? 0}
            label="Scheduled"
            icon={<Clock className="size-3.5" />}
            accent="text-blue-500"
            loading={isLoading}
          />
          <div className="h-8 w-px shrink-0 bg-border/30" />
          <StatPill
            value={counts?.sent ?? 0}
            label="Sent"
            icon={<CheckCircle2 className="size-3.5" />}
            accent="text-emerald-500"
            loading={isLoading}
          />
          <div className="h-8 w-px shrink-0 bg-border/30" />
          <StatPill
            value={counts?.failed ?? 0}
            label="Failed"
            icon={<AlertTriangle className="size-3.5" />}
            accent="text-red-500"
            loading={isLoading}
          />
        </div>
      </motion.div>

      {/* ── Tabs + list ──────────────────────────────────────────── */}
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={{ ...smoothTransition, delay: 0.08 }}
      >
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabFilter)}
        >
          <TabsList variant="line">
            <TabsTrigger value="all">
              All
              <span className="ml-1 text-xs text-muted-foreground">
                {totalCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="draft">
              Drafts
              <span className="ml-1 text-xs text-muted-foreground">
                {counts?.draft ?? 0}
              </span>
            </TabsTrigger>
            <TabsTrigger value="scheduled">
              Scheduled
              <span className="ml-1 text-xs text-muted-foreground">
                {counts?.scheduled ?? 0}
              </span>
            </TabsTrigger>
            <TabsTrigger value="sent">
              Sent
              <span className="ml-1 text-xs text-muted-foreground">
                {counts?.sent ?? 0}
              </span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            {filtered === undefined ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState tab={activeTab} onCreate={() => void handleNew()} />
            ) : (
              <motion.ul
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="space-y-2"
              >
                {filtered.map((n) => (
                  <motion.li
                    key={n._id}
                    variants={staggerItem}
                    transition={smoothTransition}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/40 px-4 py-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <NewsletterStatusBadge status={n.status} />
                      <div className="min-w-0">
                        <Link
                          href={`/projects/${projectId}/newsletters/${n.slug}`}
                          className="truncate text-sm font-semibold hover:underline"
                        >
                          {n.subject}
                        </Link>
                        <p
                          className={cn(
                            "mt-0.5 truncate text-xs text-muted-foreground/70",
                            n.status === "failed" &&
                              "text-red-600 dark:text-red-400",
                          )}
                        >
                          {n.status === "draft" &&
                            `Edited ${relativeTime(n.updatedAt)}`}
                          {n.status === "scheduled" &&
                            n.scheduledAt !== undefined &&
                            `Scheduled for ${new Date(n.scheduledAt).toLocaleString()}`}
                          {n.status === "sent" &&
                            n.sentAt !== undefined &&
                            `Sent ${relativeTime(n.sentAt)}${
                              n.recipientCount !== undefined
                                ? ` · ${n.recipientCount} recipients`
                                : ""
                            }`}
                          {n.status === "failed" &&
                            (n.errorMessage ?? "Send failed")}
                        </p>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="opacity-0 group-hover:opacity-100"
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(n.status === "draft" || n.status === "scheduled") && (
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(
                                `/projects/${projectId}/newsletters/${n.slug}`,
                              )
                            }
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {n.status !== "sent" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() =>
                                setDeleteTarget({
                                  id: n._id,
                                  subject: n.subject,
                                })
                              }
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </div>
        </Tabs>
      </motion.div>

      <ConfirmActionDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete newsletter"
        description={`Delete "${deleteTarget?.subject ?? ""}"? This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

function EmptyState({
  tab,
  onCreate,
}: {
  tab: TabFilter;
  onCreate: () => void;
}) {
  const copy: Record<TabFilter, { title: string; body: string }> = {
    all: {
      title: "No newsletters yet",
      body: "Write your first one — it sends through your connected list.",
    },
    draft: {
      title: "No drafts",
      body: "Everything you've written has moved on to scheduled or sent.",
    },
    scheduled: {
      title: "Nothing scheduled",
      body: "Schedule a draft to see it here.",
    },
    sent: {
      title: "Nothing sent yet",
      body: "Once you send a newsletter, it'll show up here.",
    },
  };
  const { title, body } = copy[tab];

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/30 px-8 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted/50">
        <Mail className="size-5 text-muted-foreground/50" />
      </div>
      <h3 className="mb-1 text-sm font-medium">{title}</h3>
      <p className="mb-5 max-w-xs text-xs text-muted-foreground/60">{body}</p>
      {tab === "all" && (
        <Button size="sm" onClick={onCreate}>
          <Plus className="size-3.5" />
          New newsletter
        </Button>
      )}
    </div>
  );
}
