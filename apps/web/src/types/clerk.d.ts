/**
 * Typed Clerk metadata. `role` is set by hand in the Clerk dashboard;
 * `"admin"` unlocks the admin routes (`useIsAdmin`, `requireAdminOr404`).
 */
export {};

declare global {
  interface UserPublicMetadata {
    role?: string;
  }
}
