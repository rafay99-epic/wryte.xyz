import { lazy, type ReactNode, Suspense } from "react";
import { Link, Navigate, Outlet, Route, Routes, useParams } from "react-router";
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
import { useUser } from "./shims/clerk-nextjs";

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
 * routing runtime differs (react-router hash history inside Electron).
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Auth */}
      <Route path="/sign-in" element={<SignInScreen />} />
      <Route path="/sign-up" element={<SignUpScreen />} />

      {/* Authenticated app shell */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/calendar" element={<GlobalCalendarPage />} />
        <Route path="/articles/new" element={<NewArticlePage />} />
        <Route path="/settings" element={<AccountSettingsPage />} />

        <Route path="/projects" element={<ProjectsListPage />} />
        <Route path="/projects/new" element={<NewProjectPage />} />

        <Route
          path="/projects/:projectId"
          element={<ProjectDashboardRoute />}
        />
        <Route
          path="/projects/:projectId/articles"
          element={<ProjectDetailRoute />}
        />
        <Route
          path="/projects/:projectId/animations"
          element={<AnimationGalleryRoute />}
        />
        <Route
          path="/projects/:projectId/calendar"
          element={<ProjectCalendarRoute />}
        />
        <Route
          path="/projects/:projectId/documents/new"
          element={<NewProjectDocumentRoute />}
        />
        <Route
          path="/projects/:projectId/media"
          element={<MediaLibraryRoute />}
        />
        <Route
          path="/projects/:projectId/settings"
          element={<ProjectSettingsRoute />}
        />
        <Route path="/projects/:projectId/trash" element={<TrashRoute />} />
        <Route
          path="/projects/:projectId/conflicts/:conflictId"
          element={<ConflictRoute />}
        />

        <Route path="/editor/:documentId" element={<EditorRoute />} />

        {/* Admin — gated client-side on Clerk publicMetadata.role */}
        <Route path="/admin" element={<AdminGate />}>
          <Route index element={<Navigate to="/admin/changelog" replace />} />
          <Route path="changelog" element={<AdminChangelogList />} />
          <Route path="changelog/new" element={<AdminChangelogNew />} />
          <Route path="changelog/:id" element={<AdminChangelogEditBridge />} />
          <Route path="feature-requests" element={<AdminFeatureRequests />} />
          <Route path="seed" element={<AdminSeed />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
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
    return <NotFound />;
  }

  return (
    <Suspense fallback={<AdminLoading />}>
      <Outlet />
    </Suspense>
  );
}

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center">
      <p className="font-mono text-[12px] uppercase tracking-wider text-muted-foreground">
        404
      </p>
      <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
      <Link
        to="/dashboard"
        className="mt-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
