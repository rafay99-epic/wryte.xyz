import type { Metadata } from "next";
import { requireAdminOr404 } from "../_lib/require-admin";
import { FeatureRequestsAdmin } from "./_components/feature-requests-admin";

export const metadata: Metadata = {
  title: "Feature requests admin",
};

export default async function FeatureRequestsAdminPage() {
  await requireAdminOr404();
  return <FeatureRequestsAdmin />;
}
