import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../app/session';

// The persistent chrome from FRONTEND_ROADMAP.md 7.1: header with actor name
// and sign-out, left navigation for the sections, and the routed outlet.
export function AppShell() {
  const { user } = useSession();

  return (
    <div className="min-h-screen bg-page font-sans text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 w-full max-w-[1280px] items-center justify-between gap-6 px-4">
          <div className="font-bold">Internal ID Admin</div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">{user.displayName}</span>
            <form method="post" action="/logout">
              <button
                type="submit"
                className="rounded-card border border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[1280px] gap-8 px-4 py-8">
        <nav aria-label="Admin sections" className="w-44 shrink-0">
          <ul className="grid gap-1">
            <NavItem to="/" end>
              Overview
            </NavItem>
            <NavItem to="/users">Users</NavItem>
            <NavItem to="/groups">Groups</NavItem>
            <NavItem to="/clients">Clients</NavItem>
            <NavItem to="/audit">Audit</NavItem>
          </ul>
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({
  to,
  end,
  children,
}: {
  to: string;
  end?: boolean;
  children: ReactNode;
}) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          `block rounded-card px-3 py-2 text-sm ${
            isActive
              ? 'bg-accent/10 font-semibold text-accent'
              : 'text-muted hover:bg-surface hover:text-ink'
          }`
        }
      >
        {children}
      </NavLink>
    </li>
  );
}
