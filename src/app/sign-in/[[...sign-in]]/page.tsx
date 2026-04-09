import { SignIn } from "@clerk/nextjs";
import Image from "next/image";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <div className="flex items-center gap-2.5">
        <Image
          src="/wryte-icon.png"
          alt="Wryte"
          width={32}
          height={32}
          className="rounded-lg"
          style={{ width: "auto", height: "auto" }}
        />
        <span className="text-2xl font-bold tracking-tight text-foreground">
          wryte
        </span>
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
