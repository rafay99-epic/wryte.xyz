"use client";

import { cn } from "@wryte/logic/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { SidebarStatusDot as StatusDot } from "@/components/layout/app-sidebar/sidebar-status-dot";

type SidebarDocumentLinkProps = {
  documentId: string;
  index: number;
  status: string;
  title: string;
};

export function SidebarDocumentLink(props: SidebarDocumentLinkProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: props.index * 0.03, duration: 0.2 }}
    >
      <Suspense fallback={<SidebarDocumentLinkContent {...props} />}>
        <PathAwareSidebarDocumentLink {...props} />
      </Suspense>
    </motion.div>
  );
}

function PathAwareSidebarDocumentLink(props: SidebarDocumentLinkProps) {
  const pathname = usePathname();

  return (
    <SidebarDocumentLinkContent
      {...props}
      isActive={pathname === `/editor/${props.documentId}`}
    />
  );
}

function SidebarDocumentLinkContent({
  documentId,
  isActive = false,
  status,
  title,
}: SidebarDocumentLinkProps & { isActive?: boolean }) {
  return (
    <Link
      href={`/editor/${documentId}`}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition-all",
        isActive
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <StatusDot status={status} />
      <span className="truncate">{title}</span>
    </Link>
  );
}
