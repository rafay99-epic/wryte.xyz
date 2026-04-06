"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  BarChart3,
  ChevronRight,
  FileText,
  Image,
  LayoutDashboard,
  PenLine,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}

function NavLink({ href, icon, label, active }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

function ProjectItem({
  project,
  isActive,
  pathname,
}: {
  project: { _id: Id<"projects">; name: string };
  isActive: boolean;
  pathname: string;
}) {
  const [expanded, setExpanded] = useState(isActive);
  const documents = useQuery(api.documents.list, { projectId: project._id });
  const docCount = documents?.length ?? 0;

  return (
    <div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <ChevronRight
            className={`size-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </button>
        <Link
          href={`/projects/${project._id}`}
          className={`flex flex-1 items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors ${
            isActive
              ? "bg-primary/10 font-medium text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span className="truncate">{project.name}</span>
          {docCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 h-5 min-w-[1.25rem] px-1.5 text-[10px]"
            >
              {docCount}
            </Badge>
          )}
        </Link>
      </div>
      {expanded && (
        <div className="ml-6 mt-1 space-y-0.5 border-l pl-3">
          <Link
            href={`/projects/${project._id}`}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
              pathname === `/projects/${project._id}`
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="size-3.5" />
            Documents
          </Link>
          <Link
            href={`/projects/${project._id}/media`}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
              pathname === `/projects/${project._id}/media`
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Image className="size-3.5" />
            Media
          </Link>
          <Link
            href={`/projects/${project._id}/settings`}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
              pathname === `/projects/${project._id}/settings`
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings className="size-3.5" />
            Settings
          </Link>
        </div>
      )}
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const projects = useQuery(api.projects.list);

  return (
    <TooltipProvider>
      <div className="flex h-full w-[280px] flex-col">
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <PenLine className="size-5 text-primary" />
          <span className="text-lg font-semibold tracking-tight">Wryte</span>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-3">
          <div className="space-y-1">
            <NavLink
              href="/dashboard"
              icon={<LayoutDashboard className="size-4" />}
              label="Dashboard"
              active={pathname === "/dashboard"}
            />
            <NavLink
              href="/documents"
              icon={<FileText className="size-4" />}
              label="All Documents"
              active={pathname === "/documents"}
            />
          </div>

          {/* Projects */}
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between px-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Projects
              </span>
              <Link
                href="/projects/new"
                className={cn(buttonVariants({ variant: "ghost", size: "icon-xs" }))}
                aria-label="Create new project"
              >
                <Plus className="size-3.5" />
              </Link>
            </div>
            <div className="space-y-0.5">
              {projects === undefined ? (
                <div className="space-y-2 px-3">
                  <Skeleton className="h-7 w-full" />
                  <Skeleton className="h-7 w-3/4" />
                </div>
              ) : projects.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No projects yet.{" "}
                  <Link
                    href="/projects/new"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Create one
                  </Link>
                </p>
              ) : (
                projects.map((project) => (
                  <ProjectItem
                    key={project._id}
                    project={project}
                    isActive={pathname.startsWith(`/projects/${project._id}`)}
                    pathname={pathname}
                  />
                ))
              )}
            </div>
          </div>

          {/* Coming Soon */}
          <Separator className="my-4" />
          <div className="px-3">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Coming Soon
            </span>
            <div className="space-y-1">
              {[
                { icon: BarChart3, label: "Analytics" },
                { icon: Search, label: "SEO Tools" },
                { icon: Users, label: "Team" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/50"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        {/* Bottom */}
        <div className="shrink-0 border-t p-3">
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "size-8",
                },
              }}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
