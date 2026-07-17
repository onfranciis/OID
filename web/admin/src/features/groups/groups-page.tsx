import { Plus, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TablePagination } from '../../components/table-pagination';
import { inputClass } from '../../components/form-field';
import { formatDate } from '../../lib/format';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { usePagedList } from '../../lib/use-paged-list';
import { useGroupsInfiniteList } from './api';

export function GroupsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const query = useGroupsInfiniteList({ q: debouncedSearch || undefined });
  const paged = usePagedList(query, debouncedSearch);
  const groups = paged.items ?? [];
  const isPageLoading = paged.items === undefined && !query.isError;

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
          className="flex items-center gap-1.5 rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create group
        </Link>
      </div>

      <div className="mt-6">
        <div className="relative w-72 max-w-full">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search slug or name"
            aria-label="Search groups"
            className={`${inputClass} w-full pl-9`}
          />
        </div>
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
            {isPageLoading ? (
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
                    className="inline-flex items-center gap-1 font-semibold text-accent"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Retry
                  </button>
                </td>
              </tr>
            ) : null}
            {!isPageLoading && !query.isError && groups.length === 0 ? (
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
                className="cursor-pointer border-b border-line last:border-b-0 hover:bg-row-hover"
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
