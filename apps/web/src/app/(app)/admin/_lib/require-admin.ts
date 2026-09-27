import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

export async function requireAdminOr404(): Promise<void> {
  const user = await currentUser();
  if (user?.publicMetadata.role !== "admin") {
    notFound();
  }
}
