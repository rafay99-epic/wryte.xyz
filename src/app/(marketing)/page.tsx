"use client";

import { useUser } from "@clerk/nextjs";
import { useRef } from "react";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingNavbar } from "@/components/layout/marketing-navbar";
import { CanvasBoard } from "@/features/marketing/components/canvas-board";
import { CanvasEditor } from "@/features/marketing/components/canvas-editor";
import { CommitTicker } from "@/features/marketing/components/commit-ticker";
import { ComparisonSection } from "@/features/marketing/components/comparison-section";
import { ConnectedFlow } from "@/features/marketing/components/connected-flow";
import { CtaDiff } from "@/features/marketing/components/cta-diff";
import { HeroDiff } from "@/features/marketing/components/hero-diff";
import { PageBackground } from "@/features/marketing/components/page-background";

export default function LandingPage() {
  const { isSignedIn } = useUser();
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen overflow-x-hidden bg-background text-foreground"
    >
      <PageBackground containerRef={containerRef} />

      <div className="relative z-10">
        <MarketingNavbar
          items={[
            { label: "Editor", scrollTo: "editor" },
            { label: "Board", scrollTo: "board" },
            { label: "How it Works", scrollTo: "how" },
            { label: "Compare", scrollTo: "comparison" },
          ]}
          onScrollTo={scrollToSection}
        />

        <HeroDiff
          isSignedIn={isSignedIn ?? false}
          onScrollTo={scrollToSection}
        />
        <CommitTicker />
        <CanvasEditor />
        <CanvasBoard />
        <ConnectedFlow />
        <ComparisonSection />
        <CtaDiff isSignedIn={isSignedIn ?? false} />
        <MarketingFooter />
      </div>
    </div>
  );
}
