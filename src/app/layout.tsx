import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/convex-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { BRAND, resolveBrandAsset } from "@/lib/branding";
import {
  SITE_AUTHOR,
  SITE_AUTHOR_URL,
  SITE_DESCRIPTION,
  SITE_GITHUB,
  SITE_NAME,
  SITE_TITLE,
  SITE_TWITTER,
  SITE_URL,
} from "@/lib/seo";

const BRAND_ICON_URL = resolveBrandAsset(BRAND.icon);

// Primary UI font — variable weights allow granular typographic control
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Monospace font used in the editor, code blocks, and slug displays
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

/* ------------------------------------------------------------------ */
/*  Full Next.js Metadata export — covers SEO, OG, Twitter, icons      */
/* ------------------------------------------------------------------ */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,

  applicationName: SITE_NAME,
  authors: [{ name: SITE_AUTHOR, url: SITE_AUTHOR_URL }],
  creator: SITE_AUTHOR,
  publisher: SITE_NAME,
  generator: "Next.js",
  keywords: [
    "markdown editor",
    "developer writing tool",
    "publish to GitHub",
    "content workflow",
    "blog editor",
    "headless CMS",
    "AI writing assistant",
    "developer blogging",
    "wryte",
  ],

  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  /* Icons — Next.js automatically generates <link> tags from these */
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: BRAND_ICON_URL, type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: BRAND_ICON_URL, sizes: "512x512" }],
  },

  manifest: "/manifest.webmanifest",

  /* Open Graph — shared previews on Facebook, LinkedIn, Discord, etc. */
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: BRAND_ICON_URL,
        width: 1024,
        height: 1024,
        alt: "Wryte — Write Now, Publish Later",
        type: "image/png",
      },
    ],
  },

  /* Twitter / X card */
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [BRAND_ICON_URL],
    creator: SITE_TWITTER,
  },

  /* Misc */
  category: "Developer Tools",
  alternates: {
    canonical: SITE_URL,
    types: {
      "application/rss+xml": [
        { url: `${SITE_URL}/rss.xml`, title: `${SITE_NAME} — Updates (RSS)` },
      ],
    },
  },

  /*
    Search-console verification slots. Populate via `NEXT_PUBLIC_*_VERIFICATION`
    env vars when verifying ownership; left undefined here so they're omitted
    from the rendered HTML when not configured.
  */
  verification: {
    google: process.env["NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION"],
    yandex: process.env["NEXT_PUBLIC_YANDEX_VERIFICATION"],
    ...(process.env["NEXT_PUBLIC_BING_SITE_VERIFICATION"] && {
      other: {
        "msvalidate.01": process.env["NEXT_PUBLIC_BING_SITE_VERIFICATION"],
      },
    }),
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  colorScheme: "dark light",
};

/**
 * Root layout for the entire application.
 *
 * Applies the two Google Fonts as CSS custom properties on `<html>` so any
 * descendant can reference `var(--font-poppins)` or `var(--font-jetbrains-mono)`.
 *
 * Provider nesting order matters:
 *  1. `Providers` — sets up the Convex client and Clerk auth context.
 *  2. `ThemeProvider` — reads the persisted theme preference and applies it.
 *  3. `Toaster` — renders toast notifications app-wide (sits outside ThemeProvider
 *     so it is always mounted regardless of theme changes).
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${jetbrainsMono.variable} h-full antialiased`}
      // Suppresses the React hydration mismatch warning caused by the
      // ThemeProvider injecting a `class` or `data-theme` attribute on the
      // server vs. client.
      suppressHydrationWarning
    >
      <head>
        {/*
          Inline script to prevent FOUC (flash of unstyled content).
          Reads the persisted theme from localStorage and applies the `dark`
          class BEFORE React hydrates, so the first paint matches the user's
          preference. This avoids a white flash on dark-mode users.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=JSON.parse(localStorage.getItem("wryte-theme")||"{}");var m=t&&t.state&&t.state.mode;if(m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme:dark)").matches)||(!m&&true)){d.classList.add("dark")}else{d.classList.remove("dark")}}catch(e){}})()`,
          }}
        />

        {/* RSS feed autodiscovery link — picked up by feed readers */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${SITE_NAME} — Updates`}
          href={`${SITE_URL}/rss.xml`}
        />

        {/* JSON-LD structured data — Organization + WebSite + SoftwareApplication + FAQPage */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${SITE_URL}/#organization`,
                  name: SITE_NAME,
                  url: SITE_URL,
                  logo: {
                    "@type": "ImageObject",
                    url: `${SITE_URL}${BRAND_ICON_URL}`,
                  },
                  sameAs: [SITE_GITHUB],
                },
                {
                  "@type": "WebSite",
                  "@id": `${SITE_URL}/#website`,
                  url: SITE_URL,
                  name: SITE_NAME,
                  description: SITE_DESCRIPTION,
                  publisher: { "@id": `${SITE_URL}/#organization` },
                  inLanguage: "en-US",
                },
                {
                  "@type": "SoftwareApplication",
                  "@id": `${SITE_URL}/#software`,
                  name: SITE_NAME,
                  url: SITE_URL,
                  applicationCategory: "DeveloperApplication",
                  operatingSystem: "Web",
                  offers: {
                    "@type": "Offer",
                    price: "0",
                    priceCurrency: "USD",
                  },
                  description: SITE_DESCRIPTION,
                },
                {
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
                },
              ],
            }),
          }}
        />
      </head>
      <body
        className="min-h-full flex flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        <Providers>
          <QueryProvider>
            <ThemeProvider>{children}</ThemeProvider>
            <Toaster />
          </QueryProvider>
        </Providers>
      </body>
    </html>
  );
}
