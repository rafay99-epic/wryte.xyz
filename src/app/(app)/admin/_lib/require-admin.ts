import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

/**
 * Server-side gate for admin routes. Loads the Clerk user and 404s
 * (rather than 403s) when `publicMetadata.role !== "admin"` so the
 * route's existence isn't leaked to non-admins. Call at the top of
 * every page under `/admin`.
 */
export async function requireAdminOr404(): Promise<void> {
  const user = await currentUser();
  const role = (user?.publicMetadata as { role?: unknown } | null)?.role;
  if (role !== "admin") {
    notFound();
  }
}
