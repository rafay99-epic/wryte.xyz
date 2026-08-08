import type { Metadata } from "next";
import { FeatureRequestsAdmin } from "./_components/feature-requests-admin";

export const metadata: Metadata = {
  title: "Feature requests admin",
};

export default function FeatureRequestsAdminPage() {
  return <FeatureRequestsAdmin />;
}
