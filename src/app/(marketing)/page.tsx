import { Clock, FileCode2, GitBranch, PenLine, Sparkles } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: FileCode2,
    title: "Markdown Editor",
    description:
      "A distraction-free editor with live preview, syntax highlighting, and frontmatter support.",
  },
  {
    icon: GitBranch,
    title: "GitHub Publishing",
    description:
      "Push your content directly to any GitHub repository with a single click.",
  },
  {
    icon: Clock,
    title: "Scheduling",
    description:
      "Schedule content to publish at the perfect time. Set it and forget it.",
  },
  {
    icon: Sparkles,
    title: "AI Enhancement",
    description:
      "Polish your writing with AI-powered suggestions and improvements. Coming soon.",
  },
];

export default function LandingPage() {
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <PenLine className="size-5 text-primary" />
            <span className="text-lg font-semibold tracking-tight">Wryte</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-6 py-24 text-center sm:py-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm text-muted-foreground">
            <PenLine className="size-4 text-primary" />
            Editor-first workflow
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Write Now, <span className="text-primary">Publish Later</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            An editor-first content workflow tool for developers. Capture rough
            ideas, refine them, and publish to GitHub when ready.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Get Started
            </Link>
            <Link
              href="/sign-in"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Sign In
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="mb-2 text-center text-2xl font-semibold tracking-tight">
              Everything you need
            </h2>
            <p className="mb-12 text-center text-muted-foreground">
              A focused toolkit for developer content workflows.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              {features.map((feature) => (
                <Card key={feature.title}>
                  <CardHeader>
                    <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                      <feature.icon className="size-5 text-primary" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Wryte. All rights reserved.</p>
      </footer>
    </>
  );
}
