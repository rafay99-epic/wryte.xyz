/**
 * Minimal Brevo (ex-Sendinblue) client. REST with an `api-key` header;
 * runs in the default Convex runtime (fetch only). Brevo owns the contact
 * list, sending, unsubscribe, and compliance — we only trigger campaigns.
 * Free tier: 300 emails/day. Scheduling is native (`scheduledAt` at create).
 */

import type { ContactList } from "./_lib/providers";

const BREVO_API = "https://api.brevo.com/v3";
const TIMEOUT_MS = 15_000;

export type BrevoResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };
export type BrevoSender = { email: string; name: string; active: boolean };

async function brevoFetch<T>(
  apiKey: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<BrevoResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${BREVO_API}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return {
      ok: false,
      message: `Could not reach Brevo: ${err instanceof Error ? err.message : "request failed"}`,
    };
  }

  if (res.status === 204) return { ok: true, data: undefined as T };
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : {};

  if (!res.ok) {
    const message =
      (body as { message?: string })?.message ??
      `Brevo returned ${res.status}.`;
    if (res.status === 401)
      return { ok: false, message: "Brevo rejected the API key." };
    return { ok: false, message: `Brevo: ${message}` };
  }
  return { ok: true, data: body as T };
}

/** Validate the key + return the account email (a cheap authed call). */
export async function validateBrevo(
  apiKey: string,
): Promise<BrevoResult<{ email: string }>> {
  const result = await brevoFetch<{ email?: string }>(apiKey, "/account");
  if (!result.ok) return result;
  return { ok: true, data: { email: result.data.email ?? "" } };
}

export async function fetchBrevoLists(
  apiKey: string,
): Promise<BrevoResult<ContactList[]>> {
  const result = await brevoFetch<{
    lists?: { id: number; name: string }[];
  }>(apiKey, "/contacts/lists?limit=50&sort=desc");
  if (!result.ok) return result;
  return {
    ok: true,
    data: (result.data.lists ?? []).map((l) => ({
      id: String(l.id),
      name: l.name,
    })),
  };
}

/** Verified senders — Brevo refuses to send from an unverified address. */
export async function fetchBrevoSenders(
  apiKey: string,
): Promise<BrevoResult<BrevoSender[]>> {
  const result = await brevoFetch<{
    senders?: { email: string; name: string; active: boolean }[];
  }>(apiKey, "/senders");
  if (!result.ok) return result;
  return { ok: true, data: result.data.senders ?? [] };
}

type CreateCampaignInput = {
  name: string;
  subject: string;
  senderEmail: string;
  senderName: string;
  htmlContent: string;
  listIds: number[];
  /** ISO 8601 with offset; omit to leave as a draft for immediate send. */
  scheduledAt?: string;
};

export async function createBrevoCampaign(
  apiKey: string,
  input: CreateCampaignInput,
): Promise<BrevoResult<{ campaignId: string }>> {
  const result = await brevoFetch<{ id: number }>(apiKey, "/emailCampaigns", {
    method: "POST",
    body: {
      name: input.name,
      subject: input.subject,
      sender: { email: input.senderEmail, name: input.senderName },
      htmlContent: input.htmlContent,
      recipients: { listIds: input.listIds },
      ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
    },
  });
  if (!result.ok) return result;
  return { ok: true, data: { campaignId: String(result.data.id) } };
}

/** Send an already-created campaign to its list immediately. */
export async function sendBrevoCampaignNow(
  apiKey: string,
  campaignId: string,
): Promise<BrevoResult<null>> {
  const result = await brevoFetch<null>(
    apiKey,
    `/emailCampaigns/${campaignId}/sendNow`,
    { method: "POST" },
  );
  return result.ok ? { ok: true, data: null } : result;
}

/** Send a preview to specific addresses only — never the list. */
export async function sendBrevoTest(
  apiKey: string,
  campaignId: string,
  emails: string[],
): Promise<BrevoResult<null>> {
  const result = await brevoFetch<null>(
    apiKey,
    `/emailCampaigns/${campaignId}/sendTest`,
    { method: "POST", body: { emailTo: emails } },
  );
  return result.ok ? { ok: true, data: null } : result;
}
