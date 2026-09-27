import { SITE_URL } from "@wryte/logic/lib/seo";
import { LandingPage } from "./_components/landing-page";

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/#faq`,
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Wryte?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Wryte is an editor-first content workflow tool for developers. Capture rough ideas in a markdown/MDX editor, refine drafts with AI, and publish straight to GitHub on a schedule.",
      },
    },
    {
      "@type": "Question",
      name: "Does Wryte support AI writing assistance?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Wryte supports Anthropic, OpenAI, and OpenRouter via user-supplied API keys (BYOK). Keys are encrypted in WorkOS Vault and read per-request.",
      },
    },
    {
      "@type": "Question",
      name: "Where is content published?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Content is published as clean commits to a GitHub repository and branch you configure per project. Scheduled publishes run on durable workflows with retries.",
      },
    },
    {
      "@type": "Question",
      name: "How much does Wryte cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Wryte is free. You bring your own AI and media provider keys, so you pay providers directly — Wryte never proxies usage.",
      },
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <LandingPage />
    </>
  );
}
