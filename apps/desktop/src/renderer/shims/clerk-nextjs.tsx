import {
  ClerkProvider,
  SignIn as ClerkSignIn,
  SignUp as ClerkSignUp,
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  SignOutButton,
  UserButton,
  useAuth,
  useUser,
  useSignIn,
  useSignUp,
  useSession,
  useSessionList,
  useClerk,
} from "@clerk/clerk-react";
import type { ComponentProps } from "react";

/**
 * Shim for `@clerk/nextjs` — re-exports the identical component/hook surface
 * from `@clerk/clerk-react`, which is the framework-agnostic build of the
 * same library. ClerkProvider accepts the same redirect URL props.
 *
 * The renderer uses hash routing (required for packaged file:// builds), so
 * the routed auth components must use Clerk's hash routing mode instead of
 * the default path routing, which reads window.location.pathname and never
 * changes under a HashRouter.
 */
export function SignIn({
  routing: _routing,
  path: _path,
  ...props
}: ComponentProps<typeof ClerkSignIn>) {
  return <ClerkSignIn routing="hash" {...props} />;
}

export function SignUp({
  routing: _routing,
  path: _path,
  ...props
}: ComponentProps<typeof ClerkSignUp>) {
  return <ClerkSignUp routing="hash" {...props} />;
}

export {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  SignOutButton,
  UserButton,
  useAuth,
  useUser,
  useSignIn,
  useSignUp,
  useSession,
  useSessionList,
  useClerk,
};
