import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { inputClass } from '../../components/form-field';
import { formatDate } from '../../lib/format';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { useGroupsInfiniteList } from './api';

export function GroupsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const query = useGroupsInfiniteList({ q: debouncedSearch || undefined });
  const groups = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Groups</h1>
          <p className="mt-1 text-sm text-muted">
            Maintain admin groups and application-facing memberships.
          </p>
        </div>
        <Link
          to="/groups/new"
          className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90"
        >
          Create group
        </Link>
      </div>

      <div className="mt-6">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search slug or name"
          aria-label="Search groups"
          className={`${inputClass} w-72 max-w-full`}
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-160 border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted uppercase">
              <th className="px-4 py-3 font-semibold">Slug</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold">Members</th>
              <th className="px-4 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  Loading groups…
                </td>
              </tr>
            ) : null}
            {query.isError ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <span className="text-danger">Could not load groups.</span>{' '}
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
            {query.isSuccess && groups.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No groups match.{' '}
                  <Link to="/groups/new" className="font-semibold text-accent">
                    Create the first one
                  </Link>
                </td>
              </tr>
            ) : null}
            {groups.map((group) => (
              <tr
                key={group.id}
                onClick={() => void navigate(`/groups/${group.id}`)}
                className="cursor-pointer border-b border-line last:border-b-0 hover:bg-page"
              >
                <td className="px-4 py-3 font-mono text-xs">
                  <Link
                    to={`/groups/${group.id}`}
                    className="hover:text-accent"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {group.slug}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium">{group.displayName}</td>
                <td className="px-4 py-3 text-muted">
                  {group.description ?? '—'}
                </td>
                <td className="px-4 py-3 text-muted">{group.memberCount}</td>
                <td className="px-4 py-3 text-muted">
                  {formatDate(group.createdAt)}
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
