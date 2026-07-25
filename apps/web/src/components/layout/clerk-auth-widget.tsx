"use client";

import { SignIn, SignUp } from "@clerk/nextjs";

// ---------------------------------------------------------------------------
// Clerk handles its own light/dark detection via `prefers-color-scheme`, so
// the widget will follow the OS / browser scheme without any extra work.
// Custom appearance variables and element overrides are commented out below
// for reference in case we ever want to re-introduce app-driven theming.
// ---------------------------------------------------------------------------

// import { useEffect, useState } from "react";
// import { useThemeStore } from "@wryte/logic/stores/theme-store";
//
// /**
//  * Resolve the active visual mode. "system" defers to the OS via the media
//  * query — we evaluate it on the client so SSR doesn't lock in the wrong scheme.
//  */
// function useResolvedTheme(): "light" | "dark" {
//   const mode = useThemeStore((s) => s.mode);
//   const [systemDark, setSystemDark] = useState(false);
//
//   useEffect(() => {
//     const mq = window.matchMedia("(prefers-color-scheme: dark)");
//     setSystemDark(mq.matches);
//     const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
//     mq.addEventListener("change", handler);
//     return () => mq.removeEventListener("change", handler);
//   }, []);
//
//   if (mode === "system") return systemDark ? "dark" : "light";
//   return mode;
// }
//
// /**
//  * Concrete palettes for Clerk's appearance API. Clerk only accepts color
//  * strings (not CSS vars), so we hand-roll the two modes. `colorNeutral` is
//  * the *contrast* shade Clerk uses to derive borders, dividers, and hover
//  * surfaces — setting it to the background colour makes those generated
//  * shades invisible, hence the inversion below.
//  */
// const lightVariables = {
//   colorPrimary: "#f59e0b",
//   colorBackground: "#ffffff",
//   colorInputBackground: "#ffffff",
//   colorInputText: "#09090b",
//   colorText: "#09090b",
//   colorTextSecondary: "#52525b",
//   colorTextOnPrimaryBackground: "#09090b",
//   colorNeutral: "#09090b",
//   colorDanger: "#dc2626",
//   colorSuccess: "#16a34a",
//   colorWarning: "#ea580c",
//   borderRadius: "0.625rem",
// };
//
// const darkVariables = {
//   colorPrimary: "#f59e0b",
//   colorBackground: "#17171f",
//   colorInputBackground: "#1f1f28",
//   colorInputText: "#fafafa",
//   colorText: "#fafafa",
//   colorTextSecondary: "#a1a1aa",
//   colorTextOnPrimaryBackground: "#09090b",
//   colorNeutral: "#fafafa",
//   colorDanger: "#f87171",
//   colorSuccess: "#34d399",
//   colorWarning: "#fb923c",
//   borderRadius: "0.625rem",
// };
//
// /**
//  * Element class overrides — applied on top of the variable palette so the
//  * critical text/divider/border parts are guaranteed to use the app's theme
//  * tokens. Tailwind `dark:` variants flip automatically with `.dark` on html.
//  */
// const sharedElements = {
//   rootBox: "mx-auto",
//   card: "shadow-xl bg-card border border-border",
//   headerTitle: "text-foreground",
//   headerSubtitle: "text-muted-foreground",
//   socialButtonsBlockButton:
//     "border-border text-foreground hover:bg-accent transition-colors",
//   socialButtonsBlockButtonText: "text-foreground font-medium",
//   dividerLine: "bg-border",
//   dividerText: "text-muted-foreground",
//   formFieldLabel: "text-foreground",
//   formFieldInput:
//     "bg-background text-foreground border-border focus:border-primary",
//   formButtonPrimary:
//     "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
//   footerActionText: "text-muted-foreground",
//   footerActionLink: "text-primary hover:text-primary/90 font-medium",
//   identityPreviewText: "text-foreground",
//   identityPreviewEditButton: "text-primary hover:text-primary/90",
//   formResendCodeLink: "text-primary hover:text-primary/90",
//   otpCodeFieldInput: "bg-background text-foreground border-border",
//   alertText: "text-foreground",
//   formFieldErrorText: "text-destructive",
//   footer: "bg-card",
// } as const;

export function ClerkSignIn() {
  // const resolved = useResolvedTheme();
  return (
    <SignIn
    // key={resolved}
    // appearance={{
    //   variables: resolved === "dark" ? darkVariables : lightVariables,
    //   elements: sharedElements,
    // }}
    />
  );
}

export function ClerkSignUp() {
  // const resolved = useResolvedTheme();
  return (
    <SignUp
    // key={resolved}
    // appearance={{
    //   variables: resolved === "dark" ? darkVariables : lightVariables,
    //   elements: sharedElements,
    // }}
    />
  );
}
