import { createClerkClient } from "@clerk/backend";

/**
 * Idempotently provision the e2e test account on the Clerk **development**
 * instance so the Playwright sign-in flow always has a known, password-enabled
 * account to log in with.
 *
 * ── Why this account? ────────────────────────────────────────────────────────
 * The authenticated smoke specs assert against **pre-existing seeded data** in
 * the local Convex backend: the "Rafay99.Com" project and its ~21 "Seeded
 * article NN" documents. That data is owned by a specific user, so the e2e
 * account MUST be that owner — a brand-new user would see an empty workspace
 * and the authed specs could not run.
 *
 * The owner's email is therefore the default here, overridable via
 * `E2E_CLERK_USER_EMAIL` for other environments/instances.
 *
 * ── How sign-in works ────────────────────────────────────────────────────────
 * The Playwright global setup signs in with @clerk/testing's *ticket* strategy:
 * it mints a one-time sign-in token via the Clerk Backend API and completes the
 * sign-in with it. That path needs no password and works even though this dev
 * instance disables the password first-factor (it is OAuth/email-code only).
 *
 * This helper therefore only *verifies* an existing account. It never mutates
 * one. The password below is used solely when creating a fresh account on an
 * empty instance (a fixed dev-only throwaway), which never happens against the
 * shared dev instance where the account already exists.
 *
 * Guard-rail: this only ever runs against a **development** Clerk instance
 * (`sk_test_...`, enforced below).
 */

export const E2E_USER_EMAIL =
  process.env["E2E_CLERK_USER_EMAIL"] ?? "99marafay@gmail.com";

// Fixed, dev-instance-only throwaway password, used only when creating a brand
// new account on an empty instance. Documented in e2e/README.md.
export const E2E_USER_PASSWORD =
  process.env["E2E_CLERK_USER_PASSWORD"] ?? "Wryte-E2E-Test!2026";

function getSecretKey(): string {
  const secretKey = process.env["CLERK_SECRET_KEY"];
  if (!secretKey) {
    throw new Error(
      "CLERK_SECRET_KEY is not set. Copy .env.local into the repo root before running e2e tests.",
    );
  }
  if (!secretKey.startsWith("sk_test_")) {
    // Guard-rail: this helper creates/updates users and must never run against
    // a production Clerk instance.
    throw new Error(
      "Refusing to run: CLERK_SECRET_KEY is not a development instance key (expected sk_test_...).",
    );
  }
  return secretKey;
}

export interface EnsuredTestUser {
  id: string;
  email: string;
  password: string;
  created: boolean;
}

export async function ensureTestUser(): Promise<EnsuredTestUser> {
  const clerk = createClerkClient({ secretKey: getSecretKey() });

  // 1. Look up an existing user by the exact email address.
  const existing = await clerk.users.getUserList({
    emailAddress: [E2E_USER_EMAIL],
    limit: 1,
  });

  if (existing.totalCount > 0 && existing.data[0]) {
    // Account already exists — nothing to mutate. Ticket-based sign-in in the
    // Playwright global setup does not need a password.
    return {
      id: existing.data[0].id,
      email: E2E_USER_EMAIL,
      password: E2E_USER_PASSWORD,
      created: false,
    };
  }

  // 2. Create the user with a verified email + fixed password.
  const user = await clerk.users.createUser({
    emailAddress: [E2E_USER_EMAIL],
    password: E2E_USER_PASSWORD,
    skipPasswordChecks: true,
    firstName: "Wryte",
    lastName: "E2E",
  });

  return {
    id: user.id,
    email: E2E_USER_EMAIL,
    password: E2E_USER_PASSWORD,
    created: true,
  };
}
