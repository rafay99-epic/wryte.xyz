import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PaginationProps = {
  /** Current 1-based page number. */
  currentPage: number;
  /** Total number of pages. */
  totalPages: number;
  /** Called when the user clicks a page button. */
  onPageChange: (page: number) => void;
  /** Maximum number of sibling pages shown on each side of current. @default 1 */
  siblingCount?: number;
  /** Optional class name for the wrapper. */
  className?: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Build the array of page numbers + ellipsis markers to render. */
function buildPageRange(
  currentPage: number,
  totalPages: number,
  siblingCount: number,
): Array<number | "ellipsis"> {
  // Total page buttons we want to show (first + last + current + 2×siblings + 2×ellipsis)
  const totalPageNumbers = siblingCount * 2 + 5;

  // If the total pages fit within our desired count, show all
  if (totalPages <= totalPageNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const showLeftEllipsis = leftSiblingIndex > 2;
  const showRightEllipsis = rightSiblingIndex < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = 3 + 2 * siblingCount;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, "ellipsis", totalPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = 3 + 2 * siblingCount;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => totalPages - rightItemCount + i + 1,
    );
    return [1, "ellipsis", ...rightRange];
  }

  // Both ellipses
  const middleRange = Array.from(
    { length: rightSiblingIndex - leftSiblingIndex + 1 },
    (_, i) => leftSiblingIndex + i,
  );
  return [1, "ellipsis", ...middleRange, "ellipsis", totalPages];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * Reusable pagination control with previous/next arrows, page numbers,
 * and ellipsis for large page counts.
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPageRange(currentPage, totalPages, siblingCount);

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-center gap-1", className)}
    >
      {/* Previous */}
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </Button>

      {/* Page numbers */}
      {pages.map((page, idx) => {
        if (page === "ellipsis") {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="flex size-8 items-center justify-center text-muted-foreground"
              aria-hidden
            >
              <MoreHorizontal className="size-4" />
            </span>
          );
        }

        const isActive = page === currentPage;
        return (
          <Button
            key={page}
            variant={isActive ? "default" : "outline"}
            size="icon-sm"
            onClick={() => onPageChange(page)}
            aria-label={`Page ${page}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "text-xs tabular-nums",
              isActive && "pointer-events-none",
            )}
          >
            {page}
          </Button>
        );
      })}

      {/* Next */}
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Per-page selector (optional companion)                             */
/* ------------------------------------------------------------------ */

type PaginationInfoProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  className?: string;
};

/**
 * Displays "Showing X-Y of Z" text alongside the pagination controls.
 */
export function PaginationInfo({
  currentPage,
  totalPages: _totalPages,
  totalItems,
  pageSize,
  className,
}: PaginationInfoProps) {
  if (totalItems === 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Showing {start}–{end} of {totalItems}
    </p>
  );
}
