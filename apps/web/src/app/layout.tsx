import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { BRAND, resolveBrandAsset } from "@wryte/logic/lib/branding";
import {
  SITE_AUTHOR,
  SITE_AUTHOR_URL,
  SITE_DESCRIPTION,
  SITE_GITHUB,
  SITE_NAME,
  SITE_TITLE,
  SITE_TWITTER,
  SITE_URL,
} from "@wryte/logic/lib/seo";
import { Toaster } from "@wryte/ui/sonner";
import { DesktopChrome } from "@/components/layout/desktop-chrome";
import { Providers } from "@/components/providers/convex-provider";
import { ServiceWorkerRegistration } from "@/components/providers/service-worker-registration";
import { ThemeProvider } from "@/components/providers/theme-provider";

const BRAND_ICON_URL = resolveBrandAsset(BRAND.icon);

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

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

  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: BRAND_ICON_URL, type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },

  manifest: "/manifest.webmanifest",

  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },

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

  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [BRAND_ICON_URL],
    creator: SITE_TWITTER,
  },

  category: "Developer Tools",
  alternates: {
    canonical: SITE_URL,
    types: {
      "application/rss+xml": [
        { url: `${SITE_URL}/rss.xml`, title: `${SITE_NAME} — Updates (RSS)` },
      ],
    },
  },

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=JSON.parse(localStorage.getItem("wryte-theme")||"{}");var m=t&&t.state&&t.state.mode;if(m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme:dark)").matches)||(!m&&true)){d.classList.add("dark")}else{d.classList.remove("dark")}}catch(e){}})()`,
          }}
        />

        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${SITE_NAME} — Updates`}
          href={`${SITE_URL}/rss.xml`}
        />

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
              ],
            }),
          }}
        />
      </head>
      <body
        className="min-h-full flex flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        <DesktopChrome />
        <Providers>
          <ThemeProvider>{children}</ThemeProvider>
          <Toaster />
          <ServiceWorkerRegistration />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
