/**
 * Newsletter provider registry — browser-safe (only `convex/values`).
 *
 * Wryte is the writing tool; the provider owns the list, the sending, the
 * compliance, and the cost. Brevo connects by API key (its public OAuth is
 * org-internal only); Mailchimp connects by OAuth (added later — the mode is
 * declared here so the UI can branch).
 */

import { v } from "convex/values";

export const NEWSLETTER_PROVIDER_IDS = ["brevo", "mailchimp"] as const;

export type NewsletterProvider = (typeof NEWSLETTER_PROVIDER_IDS)[number];

export const newsletterProviderValidator = v.union(
  v.literal("brevo"),
  v.literal("mailchimp"),
);

export type NewsletterProviderEntry = {
  id: NewsletterProvider;
  label: string;
  connect: "apikey" | "oauth";
  /** Where to get the API key (apikey providers). */
  dashboardUrl: string;
  /** The provider handles list scheduling server-side. */
  canSchedule: boolean;
  /** Not yet wired end-to-end. */
  comingSoon?: boolean;
};

export const NEWSLETTER_PROVIDERS: Record<
  NewsletterProvider,
  NewsletterProviderEntry
> = {
  brevo: {
    id: "brevo",
    label: "Brevo",
    connect: "apikey",
    dashboardUrl: "https://app.brevo.com/settings/keys/api",
    canSchedule: true,
  },
  mailchimp: {
    id: "mailchimp",
    label: "Mailchimp",
    connect: "oauth",
    dashboardUrl: "https://mailchimp.com/",
    // Free-tier Mailchimp can't schedule (Essentials+ only); detected at send.
    canSchedule: true,
    comingSoon: true,
  },
};

export const ALL_NEWSLETTER_PROVIDERS: NewsletterProviderEntry[] =
  NEWSLETTER_PROVIDER_IDS.map((id) => NEWSLETTER_PROVIDERS[id]);

/** Cached list shape stored (as JSON) on the connection row's `lists`. */
export type ContactList = { id: string; name: string };

export function parseLists(raw: string | undefined): ContactList[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is ContactList =>
        typeof l === "object" &&
        l !== null &&
        typeof (l as ContactList).id === "string" &&
        typeof (l as ContactList).name === "string",
    );
  } catch {
    return [];
  }
}
