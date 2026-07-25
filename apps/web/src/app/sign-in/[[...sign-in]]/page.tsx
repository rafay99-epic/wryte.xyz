import type { Metadata } from "next";
import Link from "next/link";
import { BrandIcon } from "@/components/branding/brand-icon";
import { ClerkSignIn } from "@/components/layout/clerk-auth-widget";
import { MarketingThemeToggle } from "@/components/layout/marketing-theme-toggle";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Wryte workspace.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://wryte.xyz/sign-in" },
};

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <div className="absolute top-4 right-4">
        <MarketingThemeToggle />
      </div>
      <Link href="/" className="flex items-center gap-2.5">
        <BrandIcon width={32} height={32} className="rounded-lg" />
        <span className="text-2xl font-bold tracking-tight text-foreground">
          wryte
        </span>
      </Link>
      <ClerkSignIn />
    </div>
  );
}
