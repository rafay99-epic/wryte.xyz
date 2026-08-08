import { Suspense } from "react";
import { requireAdminOr404 } from "./_lib/require-admin";
import AdminLoading from "./loading";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AuthorizedAdminContent>{children}</AuthorizedAdminContent>
    </Suspense>
  );
}

/**
 * Clerk's Backend API lookup is request-specific and intentionally uncached.
 * Keeping it inside this boundary lets Next prefetch the admin loading shell
 * while ensuring no protected content is streamed before authorization.
 */
async function AuthorizedAdminContent({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminOr404();
  return children;
}
