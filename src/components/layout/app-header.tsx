"use client";

import { UserButton } from "@clerk/nextjs";
import { PanelLeft, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEditorStore } from "@/stores/editor-store";

function useBreadcrumbs(): string[] {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((segment) => {
    if (segment === "dashboard") return "Dashboard";
    if (segment === "projects") return "Projects";
    if (segment === "documents") return "Documents";
    if (segment === "media") return "Media";
    if (segment === "settings") return "Settings";
    if (segment === "new") return "New";
    // For IDs, show a truncated version
    if (segment.length > 12) return `${segment.slice(0, 8)}...`;
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  });
}

export function AppHeader() {
  const toggleSidebar = useEditorStore((s) => s.toggleSidebar);
  const breadcrumbs = useBreadcrumbs();

  return (
    <TooltipProvider>
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="size-4" />
          </Button>
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, crumbIndex) => (
              <span key={crumb} className="flex items-center gap-1.5">
                {crumbIndex > 0 && <span className="text-border">/</span>}
                <span
                  className={
                    crumbIndex === breadcrumbs.length - 1
                      ? "text-foreground font-medium"
                      : ""
                  }
                >
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            disabled
            className="hidden gap-2 text-muted-foreground sm:flex"
          >
            <Search className="size-3.5" />
            <span>Search</span>
            <span className="ml-2 text-xs text-muted-foreground/60">
              Coming soon
            </span>
          </Button>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "size-7",
              },
            }}
          />
        </div>
      </header>
    </TooltipProvider>
  );
}
