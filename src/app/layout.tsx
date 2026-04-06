import type { Metadata } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/convex-provider";
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

export const metadata: Metadata = {
  title: "Wryte - Write Now, Publish Later",
  description:
    "An editor-first content workflow tool for developers. Capture rough ideas, refine them, and publish to GitHub when ready.",
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
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <ThemeProvider>{children}</ThemeProvider>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
