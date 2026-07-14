import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from '../components/app-shell';
import { ToastProvider } from '../components/toaster';
import { AuditPage } from '../features/audit/audit-page';
import { ClientCreatePage } from '../features/clients/client-create-page';
import { ClientDetailPage } from '../features/clients/client-detail-page';
import { ClientsPage } from '../features/clients/clients-page';
import { GroupsPage } from '../features/groups/groups-page';
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
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'users/new', element: <UserCreatePage /> },
      { path: 'users/:userId', element: <UserDetailPage /> },
      { path: 'groups', element: <GroupsPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'clients/new', element: <ClientCreatePage /> },
      { path: 'clients/:clientRecordId', element: <ClientDetailPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

// The SPA is mounted at /admin (same-origin under NestJS in F6; Vite base in dev).
export function createAppRouter() {
  return createBrowserRouter(routes, { basename: '/admin' });
}
