import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { inputClass } from '../../components/form-field';
import { StatusBadge } from '../../components/status-badge';
import { formatDate } from '../../lib/format';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { useUsersList } from './api';
import { USER_STATUSES, userStatusTone, type UserStatus } from './types';

export function UsersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const query = useUsersList({
    q: debouncedSearch || undefined,
    status: status || undefined,
  });

  const users = query.data?.pages.flatMap((page) => page.items) ?? [];

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
          className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90"
        >
          Create user
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search email, username, or name"
          aria-label="Search users"
          className={`${inputClass} w-72 max-w-full`}
        />
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
            {query.isPending ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Loading users…
                </td>
              </tr>
            ) : null}
            {query.isError ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <span className="text-danger">Could not load users.</span>{' '}
                  <button
                    type="button"
                    onClick={() => void query.refetch()}
                    className="font-semibold text-accent"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            ) : null}
            {query.isSuccess && users.length === 0 ? (
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
                className="cursor-pointer border-b border-line last:border-b-0 hover:bg-page"
              >
                <td className="px-4 py-3 font-medium">
                  <Link
                    to={`/users/${user.id}`}
                    className="hover:text-accent"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {user.displayName}
                  </Link>
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

      {query.hasNextPage ? (
        <div className="mt-4 text-center">
          <button
            type="button"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
            className="rounded-card border border-line bg-surface px-4 py-2 text-sm font-semibold text-accent hover:border-accent disabled:opacity-50"
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
