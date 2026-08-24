import { lazy, type ReactNode, Suspense } from "react";
import {
  createHashRouter,
  Link,
  Navigate,
  Outlet,
  useParams,
} from "react-router";
import { BrandIcon } from "@/components/branding/brand-icon";
import { AppPageSkeleton } from "@/components/feedback/skeletons/app-page-skeleton";
import {
  ClerkSignIn,
  ClerkSignUp,
} from "@/components/layout/clerk-auth-widget";
import { MarketingThemeToggle } from "@/components/layout/marketing-theme-toggle";
import { AccountSettingsPage } from "@/features/account-settings/account-settings-page";
import { AnimationGalleryPage } from "@/features/animation-gallery/animation-gallery-page";
import { CalendarPage as ProjectCalendarPage } from "@/features/calendar/calendar-page";
import { GlobalCalendarPage } from "@/features/calendar/global-calendar-page";
// Route components — the exact same feature modules the website renders.
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { EditorPage } from "@/features/editor/editor-page";
import { MediaLibraryPage } from "@/features/media-library/media-library-page";
import { NewArticlePage } from "@/features/new-article/new-article-page";
import { NewProjectPage } from "@/features/new-project/new-project-page";
import { NewProjectDocumentPage } from "@/features/new-project-document/new-project-document-page";
import { ProjectDashboardPage } from "@/features/project-dashboard/project-dashboard-page";
import { ProjectDetailPage } from "@/features/project-detail/project-detail-page";
import { ProjectSettingsPage } from "@/features/project-settings/project-settings-page";
import { ProjectsListPage } from "@/features/projects-list/projects-list-page";
import { ConflictPage } from "@/features/sync-conflicts/conflict-page";
import { TrashPage } from "@/features/trash/trash-page";
import { AppLayout } from "./layouts/app-layout";
import { AppProviders } from "./providers/app-providers";
import { useUser } from "./shims/clerk-nextjs";
import {
  AppErrorBoundary,
  AppNotFound,
  EditorErrorBoundary,
} from "./error-boundary";

// Admin pages reuse the Next page components directly (thin wrappers around
// their _components); params are bridged from react-router.
const AdminChangelogList = lazy(
  () => import("@/app/(app)/admin/changelog/page"),
);
const AdminChangelogNew = lazy(
  () => import("@/app/(app)/admin/changelog/new/page"),
);
const AdminChangelogEdit = lazy(
  () => import("@/app/(app)/admin/changelog/[id]/page"),
);
const AdminFeatureRequests = lazy(
  () => import("@/app/(app)/admin/feature-requests/page"),
);
const AdminSeed = lazy(() => import("@/app/(app)/admin/seed/page"));
const AdminLoading = lazy(() => import("@/app/(app)/admin/loading"));

/**
 * Full route table — a one-to-one mirror of the web app's `(app)` route
 * group plus the auth screens. Paths are identical to the website; only the
 * routing runtime differs (react-router data router with hash history inside
 * Electron, required so packaged file:// builds work).
 *
 * Error boundaries reuse the web app's error components; the editor route
 * gets its editor-specific boundary, everything else under the shell shares
 * the app-level one.
 */
export const router = createHashRouter([
  {
    element: <AppProvidersRoute />,
    errorElement: <AppErrorBoundary />,
    children: [
      { path: "/", element: <Navigate to="/dashboard" replace /> },

      // Auth
      { path: "/sign-in", element: <SignInScreen /> },
      { path: "/sign-up", element: <SignUpScreen /> },

      // Authenticated app shell
      {
        path: "/",
        element: <AppLayout />,
        children: [
          { path: "dashboard", element: <DashboardPage /> },
          { path: "calendar", element: <GlobalCalendarPage /> },
          { path: "articles/new", element: <NewArticlePage /> },
          { path: "settings", element: <AccountSettingsPage /> },

          { path: "projects", element: <ProjectsListPage /> },
          { path: "projects/new", element: <NewProjectPage /> },

          {
            path: "projects/:projectId",
            element: <ProjectDashboardRoute />,
          },
          {
            path: "projects/:projectId/articles",
            element: <ProjectDetailRoute />,
          },
          {
            path: "projects/:projectId/animations",
            element: <AnimationGalleryRoute />,
          },
          {
            path: "projects/:projectId/calendar",
            element: <ProjectCalendarRoute />,
          },
          {
            path: "projects/:projectId/documents/new",
            element: <NewProjectDocumentRoute />,
          },
          {
            path: "projects/:projectId/media",
            element: <MediaLibraryRoute />,
          },
          {
            path: "projects/:projectId/settings",
            element: <ProjectSettingsRoute />,
          },
          { path: "projects/:projectId/trash", element: <TrashRoute /> },
          {
            path: "projects/:projectId/conflicts/:conflictId",
            element: <ConflictRoute />,
          },

          {
            path: "editor/:documentId",
            element: <EditorRoute />,
            errorElement: <EditorErrorBoundary />,
          },

          // Admin — gated client-side on Clerk publicMetadata.role
          {
            path: "admin",
            element: <AdminGate />,
            children: [
              { index: true, element: <Navigate to="/admin/changelog" replace /> },
              { path: "changelog", element: <AdminChangelogList /> },
              { path: "changelog/new", element: <AdminChangelogNew /> },
              { path: "changelog/:id", element: <AdminChangelogEditBridge /> },
              { path: "feature-requests", element: <AdminFeatureRequests /> },
              { path: "seed", element: <AdminSeed /> },
            ],
          },
        ],
      },

      { path: "*", element: <AppNotFound /> },
    ],
  },
]);

/** Wraps the whole tree in the shared providers inside the data router. */
function AppProvidersRoute() {
  return (
    <AppProviders>
      <Outlet />
    </AppProviders>
  );
}

/* ------------------------------------------------------------------ */
/*  Auth screens                                                       */
/* ------------------------------------------------------------------ */

function SignInScreen() {
  return (
    <AuthScreen>
      <ClerkSignIn />
    </AuthScreen>
  );
}

function SignUpScreen() {
  return (
    <AuthScreen>
      <ClerkSignUp />
    </AuthScreen>
  );
}

function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <div className="absolute top-4 right-4">
        <MarketingThemeToggle />
      </div>
      <Link to="/" className="flex items-center gap-2.5">
        <BrandIcon width={32} height={32} className="rounded-lg" />
        <span className="text-2xl font-bold tracking-tight text-foreground">
          wryte
        </span>
      </Link>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Param bridges (react-router params → feature props)                */
/* ------------------------------------------------------------------ */

function ProjectDashboardRoute() {
  const { projectId } = useParams();
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <ProjectDashboardPage projectId={projectId ?? ""} />
    </Suspense>
  );
}

function ProjectDetailRoute() {
  const { projectId } = useParams();
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <ProjectDetailPage projectId={projectId ?? ""} />
    </Suspense>
  );
}

function AnimationGalleryRoute() {
  const { projectId } = useParams();
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <AnimationGalleryPage projectId={projectId ?? ""} />
    </Suspense>
  );
}

function ProjectCalendarRoute() {
  const { projectId } = useParams();
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <ProjectCalendarPage projectId={projectId ?? ""} />
    </Suspense>
  );
}

function NewProjectDocumentRoute() {
  const { projectId } = useParams();
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <NewProjectDocumentPage projectId={projectId ?? ""} />
    </Suspense>
  );
}

function MediaLibraryRoute() {
  const { projectId } = useParams();
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <MediaLibraryPage projectId={projectId ?? ""} />
    </Suspense>
  );
}

function ProjectSettingsRoute() {
  const { projectId } = useParams();
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <ProjectSettingsPage projectId={projectId ?? ""} />
    </Suspense>
  );
}

function TrashRoute() {
  const { projectId } = useParams();
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <TrashPage projectId={projectId ?? ""} />
    </Suspense>
  );
}

function ConflictRoute() {
  const { projectId, conflictId } = useParams();
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <ConflictPage projectId={projectId ?? ""} conflictId={conflictId ?? ""} />
    </Suspense>
  );
}

function EditorRoute() {
  const { documentId } = useParams();
  return (
    <Suspense fallback={<AppPageSkeleton className="h-full w-full" />}>
      <EditorPage documentId={documentId ?? ""} />
    </Suspense>
  );
}

function AdminChangelogEditBridge() {
  const { id } = useParams();
  const Page = AdminChangelogEdit;
  return <Page params={Promise.resolve({ id: id ?? "" })} />;
}

/* ------------------------------------------------------------------ */
/*  Admin gate                                                         */
/* ------------------------------------------------------------------ */

/**
 * The web gates admin routes server-side (`require-admin.ts` via Clerk's
 * Backend API). A pure SPA has no server boundary, so gate client-side on
 * the same signal: `publicMetadata.role === "admin"`. Non-admins get the
 * same 404 the website serves so the routes' existence isn't leaked.
 */
function AdminGate() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return <AdminLoading />;
  }

  const role = (user?.publicMetadata as { role?: unknown } | null)?.role;
  if (!isSignedIn || role !== "admin") {
    return <AppNotFound />;
  }

  return (
    <Suspense fallback={<AdminLoading />}>
      <Outlet />
    </Suspense>
  );
}
