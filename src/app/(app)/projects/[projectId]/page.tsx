"use client";

import { useMutation, useQuery } from "convex/react";
import {
  FileText,
  Loader2,
  MoreHorizontal,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { CreateDocumentDialog } from "@/components/projects/create-document-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

type StatusFilter = "all" | "draft" | "scheduled" | "published";

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;

  const project = useQuery(api.projects.get, { projectId });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  if (project === undefined) {
    return <ProjectDetailSkeleton />;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            /{project.slug}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}/settings`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Settings className="size-4" />
            Settings
          </Link>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="size-4" />
            New Document
          </Button>
        </div>
      </div>

      <Tabs
        defaultValue="all"
        value={statusFilter}
        onValueChange={(val) => setStatusFilter(val as StatusFilter)}
      >
        <TabsList variant="line">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <DocumentList
            projectId={projectId}
            statusFilter="all"
            onCreateClick={() => setCreateDialogOpen(true)}
          />
        </TabsContent>
        <TabsContent value="draft" className="mt-4">
          <DocumentList
            projectId={projectId}
            statusFilter="draft"
            onCreateClick={() => setCreateDialogOpen(true)}
          />
        </TabsContent>
        <TabsContent value="scheduled" className="mt-4">
          <DocumentList
            projectId={projectId}
            statusFilter="scheduled"
            onCreateClick={() => setCreateDialogOpen(true)}
          />
        </TabsContent>
        <TabsContent value="published" className="mt-4">
          <DocumentList
            projectId={projectId}
            statusFilter="published"
            onCreateClick={() => setCreateDialogOpen(true)}
          />
        </TabsContent>
      </Tabs>

      <CreateDocumentDialog
        projectId={projectId}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}

function DocumentList({
  projectId,
  statusFilter,
  onCreateClick,
}: {
  projectId: Id<"projects">;
  statusFilter: StatusFilter;
  onCreateClick: () => void;
}) {
  const queryArgs =
    statusFilter === "all"
      ? { projectId }
      : { projectId, status: statusFilter as "draft" | "scheduled" | "published" };
  const documents = useQuery(api.documents.list, queryArgs);

  const [deleteTarget, setDeleteTarget] = useState<Id<"documents"> | null>(
    null,
  );

  if (documents === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    const emptyMessage =
      statusFilter === "all"
        ? "No documents yet. Create your first one to get started."
        : `No ${statusFilter} documents.`;

    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
        <FileText className="mb-3 size-10 text-muted-foreground/50" />
        <p className="mb-4 text-sm text-muted-foreground">{emptyMessage}</p>
        {statusFilter === "all" && (
          <Button size="sm" onClick={onCreateClick}>
            <Plus className="size-4" />
            New Document
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {documents.map((doc) => (
          <DocumentRow
            key={doc._id}
            document={doc}
            onDelete={() => setDeleteTarget(doc._id)}
          />
        ))}
      </div>
      {deleteTarget && (
        <DeleteDocumentDialog
          documentId={deleteTarget}
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        />
      )}
    </>
  );
}

function DocumentRow({
  document,
  onDelete,
}: {
  document: {
    _id: Id<"documents">;
    title: string;
    slug: string;
    status: "draft" | "scheduled" | "published";
    content: string;
    updatedAt: number;
  };
  onDelete: () => void;
}) {
  const excerpt =
    document.content.length > 100
      ? `${document.content.slice(0, 100)}...`
      : document.content;

  return (
    <Card size="sm" className="group relative transition-colors hover:bg-muted/30">
      <CardContent className="flex items-start justify-between gap-4">
        <Link
          href={`/editor/${document._id}`}
          className="min-w-0 flex-1"
        >
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{document.title}</h3>
            <DocumentStatusBadge status={document.status} />
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            /{document.slug}
          </p>
          {excerpt && (
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
              {excerpt}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Updated {new Date(document.updatedAt).toLocaleDateString()}
          </p>
        </Link>
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
            <DropdownMenuItem
              className="text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

function DeleteDocumentDialog({
  documentId,
  open,
  onOpenChange,
}: {
  documentId: Id<"documents">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const removeDocument = useMutation(api.documents.remove);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await removeDocument({ documentId });
      toast.success("Document deleted");
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setIsDeleting(false);
    }
  }, [documentId, removeDocument, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Document</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this document? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="size-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDetailSkeleton() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      <Skeleton className="mb-4 h-8 w-64" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
