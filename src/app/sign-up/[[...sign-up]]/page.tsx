import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a Wryte account and start publishing to GitHub.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://wryte.xyz/sign-up" },
};

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <div className="flex items-center gap-2.5">
        <Image
          src="/wryte-icon.png"
          alt="Wryte"
          width={32}
          height={32}
          className="rounded-lg"
        />
        <span className="text-2xl font-bold tracking-tight text-foreground">
          wryte
        </span>
      </div>
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
          },
        }}
      />
    </div>
  );
}
