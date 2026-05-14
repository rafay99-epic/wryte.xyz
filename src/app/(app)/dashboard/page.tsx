import type { Metadata } from "next";
import { DashboardPage } from "@/features/dashboard/dashboard-page";

export const metadata: Metadata = {
  title: "Dashboard — Wryte",
};

export default function Page() {
  return <DashboardPage />;
}
