"use client";

import { useUser } from "@clerk/nextjs";
import { useRef } from "react";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingNavbar } from "@/components/layout/marketing-navbar";
import { BoardSection } from "@/features/marketing/components/board-section";
import { CtaSection } from "@/features/marketing/components/cta-section";
import { EditorSection } from "@/features/marketing/components/editor-section";
import { FeaturesSection } from "@/features/marketing/components/features-section";
import { HeroSection } from "@/features/marketing/components/hero-section";
import { MarqueeSection } from "@/features/marketing/components/marquee-section";
import { PageBackground } from "@/features/marketing/components/page-background";
import { StatementSection } from "@/features/marketing/components/statement-section";
import { WorkflowSection } from "@/features/marketing/components/workflow-section";

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
            { label: "Features", scrollTo: "features" },
            { label: "Editor", scrollTo: "editor" },
            { label: "Board", scrollTo: "board" },
            { label: "How it Works", href: "/how-it-works" },
          ]}
          onScrollTo={scrollToSection}
        />

        <HeroSection isSignedIn={isSignedIn ?? false} />
        <MarqueeSection />
        <StatementSection />
        <EditorSection />
        <BoardSection />
        <FeaturesSection />
        <WorkflowSection />
        <CtaSection isSignedIn={isSignedIn ?? false} />
        <MarketingFooter />
      </div>
    </div>
  );
}
