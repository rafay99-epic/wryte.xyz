"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type SidebarNavLinkProps = {
  href: string;
  icon: React.ElementType;
  label: string;
  /** Override automatic active detection (e.g. for parent-of-route highlighting). */
  active?: boolean;
  /** Match `pathname === href` exactly instead of allowing prefix matches. */
  exact?: boolean;
};

/**
 * Single sidebar navigation row. Uses Framer Motion's `layoutId` to
 * animate the left-edge active indicator between rows as the user navigates.
 */
export function SidebarNavLink({
  href,
  icon: Icon,
  label,
  active,
  exact,
}: SidebarNavLinkProps) {
  const pathname = usePathname();
  const isActive =
    active ??
    (exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all duration-150",
        isActive
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
      {isActive && (
        <motion.div
          layoutId="sidebarActiveIndicator"
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </Link>
  );
}
