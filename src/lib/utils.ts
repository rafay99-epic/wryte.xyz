import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges CSS class names with Tailwind CSS conflict resolution.
 *
 * Combines clsx (conditional class joining) with tailwind-merge (deduplicates
 * and resolves conflicting Tailwind utilities, e.g., "px-2 px-4" -> "px-4").
 * This is the standard pattern for components that accept a className prop
 * alongside internal Tailwind classes.
 *
 * @example cn("px-2 py-1", isActive && "bg-blue-500", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
