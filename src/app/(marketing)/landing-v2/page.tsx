"use client";

import { useUser } from "@clerk/nextjs";
import { useRef } from "react";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingNavbar } from "@/components/layout/marketing-navbar";
import { PageBackground } from "@/features/marketing/components/page-background";
import { CanvasBoard } from "@/features/marketing/v2/components/canvas-board";
import { CanvasEditor } from "@/features/marketing/v2/components/canvas-editor";
import { CommitTicker } from "@/features/marketing/v2/components/commit-ticker";
import { ComparisonSection } from "@/features/marketing/v2/components/comparison-section";
import { ConnectedFlow } from "@/features/marketing/v2/components/connected-flow";
import { CtaDiff } from "@/features/marketing/v2/components/cta-diff";
import { HeroDiff } from "@/features/marketing/v2/components/hero-diff";

/**
 * v2 landing page — "diff hero + product canvas" concept.
 *
 * Lives at /landing-v2 as a preview alongside the current landing page.
 * Reuses the shared navbar, footer, page background, palette, and fonts so
 * only the section layout and personality change.
 */
export default function LandingV2Page() {
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
