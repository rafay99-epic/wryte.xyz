/**
 * Shim for `@clerk/nextjs` — re-exports the identical component/hook surface
 * from `@clerk/clerk-react`, which is the framework-agnostic build of the
 * same library. ClerkProvider accepts the same redirect URL props.
 */
export {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  SignInButton,
  SignOutButton,
  SignUp,
  SignUpButton,
  UserButton,
  useAuth,
  useClerk,
  useSession,
  useSessionList,
  useSignIn,
  useSignUp,
  useUser,
} from "@clerk/clerk-react";
