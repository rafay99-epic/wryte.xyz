import { createClerkClient } from "@clerk/backend";

export const E2E_USER_EMAIL =
  process.env["E2E_CLERK_USER_EMAIL"] ?? "99marafay@gmail.com";

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

  const existing = await clerk.users.getUserList({
    emailAddress: [E2E_USER_EMAIL],
    limit: 1,
  });

  if (existing.totalCount > 0 && existing.data[0]) {
    return {
      id: existing.data[0].id,
      email: E2E_USER_EMAIL,
      password: E2E_USER_PASSWORD,
      created: false,
    };
  }

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
