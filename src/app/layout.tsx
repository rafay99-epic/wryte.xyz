import type { Metadata } from "next";
import { JetBrains_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/convex-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";

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
/*  Site-wide constants used in metadata, JSON-LD, and OG tags         */
/* ------------------------------------------------------------------ */
const SITE_URL = "https://wryte.xyz";
const SITE_NAME = "Wryte";
const SITE_TITLE = "Wryte – Write Now, Publish Later";
const SITE_DESCRIPTION =
  "An editor-first content workflow tool for developers. Capture rough ideas, refine them with AI, and publish to GitHub when ready.";

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
  authors: [{ name: "Abdul Rafay", url: "https://future-dev.xyz" }],
  creator: "Abdul Rafay",
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
      { url: "/wryte-icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/wryte-icon.png", sizes: "512x512" }],
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
        url: "/wryte-logos.png",
        width: 1200,
        height: 630,
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
    images: ["/wryte-logos.png"],
    creator: "@rafay99-epic",
  },

  /* Misc */
  category: "Developer Tools",
  alternates: {
    canonical: SITE_URL,
  },
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

        {/* JSON-LD structured data — Organization + WebSite + SoftwareApplication */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://wryte.xyz/#organization",
                  name: "Wryte",
                  url: "https://wryte.xyz",
                  logo: {
                    "@type": "ImageObject",
                    url: "https://wryte.xyz/wryte-logos.png",
                  },
                  sameAs: ["https://github.com/rafay99-epic/wryte.xyz"],
                },
                {
                  "@type": "WebSite",
                  "@id": "https://wryte.xyz/#website",
                  url: "https://wryte.xyz",
                  name: "Wryte",
                  description:
                    "An editor-first content workflow tool for developers. Capture rough ideas, refine them with AI, and publish to GitHub when ready.",
                  publisher: { "@id": "https://wryte.xyz/#organization" },
                  inLanguage: "en-US",
                },
                {
                  "@type": "SoftwareApplication",
                  name: "Wryte",
                  url: "https://wryte.xyz",
                  applicationCategory: "DeveloperApplication",
                  operatingSystem: "Web",
                  offers: {
                    "@type": "Offer",
                    price: "0",
                    priceCurrency: "USD",
                  },
                  description:
                    "An editor-first content workflow tool for developers. Capture rough ideas, refine them with AI, and publish to GitHub when ready.",
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
