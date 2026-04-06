import { SignIn } from "@clerk/nextjs";
import { PenLine } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <div className="flex items-center gap-2">
        <PenLine className="size-6 text-primary" />
        <span className="text-2xl font-bold tracking-tight">Wryte</span>
      </div>
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
          },
        }}
      />
    </div>
  );
}
