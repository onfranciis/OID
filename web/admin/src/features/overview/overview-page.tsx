import {
  ArrowUpRight,
  CopyPlus,
  Grid2X2Plus,
  UserPlus,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSession } from '../../app/session';
import { SECTION_ICONS } from '../../components/app-shell';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime } from '../../lib/format';
import { useAuditEvents } from '../audit/api';
import { auditSeverityTone } from '../audit/types';
import { useClientsList } from '../clients/api';
import { useGroupsList } from '../groups/api';
import { useUsersList } from '../users/api';

export function OverviewPage() {
  const { user } = useSession();
  const usersQuery = useUsersList({});
  const groupsQuery = useGroupsList();
  const clientsQuery = useClientsList({});
  const recentQuery = useAuditEvents({ limit: 8 });

  const usersFirstPage = usersQuery.data?.pages[0];
  const usersCount = usersFirstPage
    ? `${usersFirstPage.items.length}${usersFirstPage.nextCursor ? '+' : ''}`
    : '—';
  const groupsCount = groupsQuery.data
    ? String(groupsQuery.data.items.length)
    : '—';
  const clientsFirstPage = clientsQuery.data?.pages[0];
  const clientsCount = clientsFirstPage
    ? `${clientsFirstPage.items.length}${clientsFirstPage.nextCursor ? '+' : ''}`
    : '—';
  const recentEvents = recentQuery.data?.pages[0]?.items;

  return (
    <section>
      <h1 className="text-2xl font-semibold">Admin console</h1>
      <p className="mt-1 text-sm text-muted">
        Signed in as {user.displayName}.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          to="/users"
          label="Users"
          count={usersCount}
          icon={SECTION_ICONS.users}
        />

        <Tile
          to="/groups"
          label="Groups"
          count={groupsCount}
          icon={SECTION_ICONS.groups}
        />

        <Tile
          to="/clients"
          label="Clients"
          count={clientsCount}
          icon={SECTION_ICONS.clients}
        />
        <Tile
          to="/audit"
          label="Audit"
          count="View"
          icon={SECTION_ICONS.audit}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <QuickAction to="/users/new" label="Create user" icon={UserPlus} />
        <QuickAction
          to="/clients/new"
          label="Create client"
          icon={Grid2X2Plus}
        />
        <QuickAction to="/groups/new" label="Create group" icon={CopyPlus} />
      </div>

      <section className="mt-8 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent activity</h2>
          <Link
            to="/audit"
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
          >
            View all
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-4">
          {recentQuery.isPending ? (
            <p className="text-sm text-muted">Loading activity…</p>
          ) : null}
          {recentQuery.isError ? (
            <p className="text-sm text-danger">Could not load activity.</p>
          ) : null}
          {recentQuery.isSuccess && recentEvents?.length === 0 ? (
            <p className="text-sm text-muted">No recent events.</p>
          ) : null}
          <ul className="grid gap-2">
            {recentEvents?.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-3 border-b border-line pb-2 text-sm last:border-b-0 last:pb-0"
              >
                <Link
                  to={`/audit?eventType=${event.eventType}`}
                  className="font-mono text-xs hover:text-accent"
                >
                  {event.eventType}
                </Link>

                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge
                    label={event.severity}
                    tone={auditSeverityTone(event.severity)}
                  />

                  <span className="text-xs text-muted">
                    {formatDateTime(event.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </section>
  );
}

function Tile({
  to,
  label,
  count,
  icon: Icon,
}: {
  to: string;
  label: string;
  count: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-line bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40"
    >
      <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
      <div className="mt-3 text-3xl font-bold tracking-tight">{count}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </Link>
  );
}

function QuickAction({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: React.ForwardRefExoticComponent<
    Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>
  >;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 rounded-card border border-accent/40 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
