import {
  AppWindow,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Shapes,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { performLogout } from '../app/logout';
import { useSession } from '../app/session';
import { useDocumentTitle } from '../lib/use-document-title';

// Shared with the Overview tiles so the same section always reads with the
// same icon everywhere in the app.
export const SECTION_ICONS: Record<
  'overview' | 'users' | 'groups' | 'clients' | 'audit',
  LucideIcon
> = {
  overview: LayoutDashboard,
  users: Users,
  groups: Shapes,
  clients: AppWindow,
  audit: ScrollText,
};

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? '');

  return letters.join('').toUpperCase() || '?';
}

// Dashboard chrome (FRONTEND_ROADMAP.md 7.1): a rounded sidebar card holding the
// brand, section navigation, and the signed-in admin; the routed content sits
// beside it on the page.
export function AppShell() {
  const { user } = useSession();
  useDocumentTitle();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = () => {
    setSigningOut(true);
    void performLogout();
  };

  return (
    <div className="min-h-screen bg-page p-3 font-sans text-ink sm:p-4">
      <a
        href="#admin-main"
        className="sr-only rounded-card bg-accent px-3 py-2 text-sm font-semibold text-surface focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <div className="mx-auto flex w-full max-w-[2000px] flex-col gap-4 md:flex-row md:items-start">
        <aside className="rounded-xl border border-line bg-surface p-4 shadow-sm md:sticky md:top-4 md:w-60 md:shrink-0">
          <div className="flex items-center gap-2.5 px-1 py-1">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-sm font-bold text-surface">
              ID
            </span>
            <span className="text-lg font-bold">Internal ID</span>
          </div>

          <nav aria-label="Admin sections" className="mt-6">
            <ul className="grid gap-1">
              <NavItem to="/" end icon={SECTION_ICONS.overview}>
                Overview
              </NavItem>
              <NavItem to="/users" icon={SECTION_ICONS.users}>
                Users
              </NavItem>
              <NavItem to="/groups" icon={SECTION_ICONS.groups}>
                Groups
              </NavItem>
              <NavItem to="/clients" icon={SECTION_ICONS.clients}>
                Clients
              </NavItem>
              <NavItem to="/audit" icon={SECTION_ICONS.audit}>
                Audit
              </NavItem>
            </ul>
          </nav>

          <div className="mt-6 border-t border-line pt-4">
            <div className="flex items-center gap-3 px-1">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                {initials(user.displayName)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {user.displayName}
                </div>
                <div className="truncate text-xs text-muted">{user.email}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-card border border-line px-3 py-2 text-sm font-medium text-muted hover:border-accent hover:text-accent disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </aside>

        <main id="admin-main" tabIndex={-1} className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({
  to,
  end,
  icon: Icon,
  children,
}: {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm ${
            isActive
              ? 'bg-accent/10 font-semibold text-accent'
              : 'text-muted hover:bg-nav-hover hover:text-ink'
          }`
        }
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {children}
      </NavLink>
    </li>
  );
}
