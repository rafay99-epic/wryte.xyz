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

async function AuthorizedAdminContent({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminOr404();
  return children;
}
