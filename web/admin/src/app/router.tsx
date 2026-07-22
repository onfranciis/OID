import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from '../components/app-shell';
import { RouteErrorElement } from '../components/error-boundary';
import { ToastProvider } from '../components/toaster';
import { AccountPage } from '../features/account/account-page';
import { AuditPage } from '../features/audit/audit-page';
import { LoginPage } from '../features/auth/login-page';
import { ClientCreatePage } from '../features/clients/client-create-page';
import { ClientDetailPage } from '../features/clients/client-detail-page';
import { ClientsPage } from '../features/clients/clients-page';
import { GroupCreatePage } from '../features/groups/group-create-page';
import { GroupDetailPage } from '../features/groups/group-detail-page';
import { GroupsPage } from '../features/groups/groups-page';
import { ForgotPasswordPage } from '../features/auth/forgot-password-page';
import { ResetPasswordPage } from '../features/auth/reset-password-page';
import { AcceptInvitePage } from '../features/invite/accept-invite-page';
import { NotFoundPage } from '../features/not-found-page';
import { OverviewPage } from '../features/overview/overview-page';
import { UserCreatePage } from '../features/users/user-create-page';
import { UserDetailPage } from '../features/users/user-detail-page';
import { UsersPage } from '../features/users/users-page';
import { ReauthProvider } from './reauth';
import { SessionBoundary } from './session';

function AdminLayout() {
  return (
    <SessionBoundary>
      <ReauthProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </ReauthProvider>
    </SessionBoundary>
  );
}

// Exported separately so tests can mount the same tree on a memory router.
export const routes: RouteObject[] = [
  // Outside the session boundary: never bootstraps a session or redirect-loops.
  {
    path: '/login',
    element: (
      <ToastProvider>
        <LoginPage />
      </ToastProvider>
    ),
  },
  {
    path: '/invite/:token',
    element: (
      <ToastProvider>
        <AcceptInvitePage />
      </ToastProvider>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <ToastProvider>
        <ForgotPasswordPage />
      </ToastProvider>
    ),
  },
  {
    path: '/reset-password/:token',
    element: (
      <ToastProvider>
        <ResetPasswordPage />
      </ToastProvider>
    ),
  },
  {
    path: '/',
    element: <AdminLayout />,
    errorElement: <RouteErrorElement />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'users/new', element: <UserCreatePage /> },
      { path: 'users/:userId', element: <UserDetailPage /> },
      { path: 'groups', element: <GroupsPage /> },
      { path: 'groups/new', element: <GroupCreatePage /> },
      { path: 'groups/:groupId', element: <GroupDetailPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'clients/new', element: <ClientCreatePage /> },
      { path: 'clients/:clientRecordId', element: <ClientDetailPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes, { basename: '/admin' });
}
