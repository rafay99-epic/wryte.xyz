import type { Metadata } from "next";
import { AccountSettingsPage } from "@/features/account-settings/account-settings-page";

export const metadata: Metadata = {
  title: "Settings",
};

export default function Page() {
  return <AccountSettingsPage />;
}
