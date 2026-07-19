import { Plus, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../../app/session';
import { TablePagination } from '../../components/table-pagination';
import { inputClass } from '../../components/form-field';
import { StatusBadge } from '../../components/status-badge';
import { formatDate } from '../../lib/format';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { usePagedList } from '../../lib/use-paged-list';
import { useUsersList } from './api';
import { USER_STATUSES, userStatusTone, type UserStatus } from './types';

export function UsersPage() {
  const navigate = useNavigate();
  const session = useSession();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const query = useUsersList({
    q: debouncedSearch || undefined,
    status: status || undefined,
  });

  const paged = usePagedList(query, `${debouncedSearch}|${status}`);
  const users = paged.items ?? [];
  const isPageLoading = paged.items === undefined && !query.isError;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="mt-1 text-sm text-muted">
            Create users, manage profiles, and control lifecycle status.
          </p>
        </div>
        <Link
          to="/users/new"
          className="flex items-center gap-1.5 rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create user
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative w-72 max-w-full">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search email, username, or name"
            aria-label="Search users"
            className={`${inputClass} w-full pl-9`}
          />
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as UserStatus | '')}
          aria-label="Filter by status"
          className={inputClass}
        >
          <option value="">All statuses</option>
          {USER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-160 border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted uppercase">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Username</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {isPageLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Loading users…
                </td>
              </tr>
            ) : null}
            {query.isError ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-danger">Could not load users.</span>{' '}
                    <button
                      type="button"
                      onClick={() => void query.refetch()}
                      className="inline-flex items-center gap-1 font-semibold text-accent"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            ) : null}
            {!isPageLoading && !query.isError && users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No users match.{' '}
                  <Link to="/users/new" className="font-semibold text-accent">
                    Create the first one
                  </Link>
                </td>
              </tr>
            ) : null}
            {users.map((user) => (
              <tr
                key={user.id}
                onClick={() => void navigate(`/users/${user.id}`)}
                className="cursor-pointer border-b border-line last:border-b-0 hover:bg-row-hover"
              >
                <td className="px-4 py-3 font-medium">
                  <Link
                    to={`/users/${user.id}`}
                    className="hover:text-accent"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {user.displayName}
                  </Link>
                  {user.id === session.user.id ? (
                    <span className="ml-1.5 text-xs font-normal text-muted">
                      (you)
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted">{user.email}</td>
                <td className="px-4 py-3 text-muted">{user.username ?? '—'}</td>
                <td className="px-4 py-3 text-muted">{user.profileType}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    label={user.status}
                    tone={userStatusTone(user.status)}
                  />
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatDate(user.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePagination
        pageNumber={paged.pageNumber}
        hasPreviousPage={paged.hasPreviousPage}
        hasNextPage={paged.hasNextPage}
        isFetchingNextPage={paged.isFetchingNextPage}
        onPrevious={paged.goToPreviousPage}
        onNext={paged.goToNextPage}
      />
    </section>
  );
}
