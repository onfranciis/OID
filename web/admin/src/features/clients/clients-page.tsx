import { Plus, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TablePagination } from '../../components/table-pagination';
import { inputClass } from '../../components/form-field';
import { StatusBadge } from '../../components/status-badge';
import { formatDate } from '../../lib/format';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { usePagedList } from '../../lib/use-paged-list';
import { useClientsList } from './api';
import {
  CLIENT_STATUSES,
  clientStatusTone,
  type OidcClientStatus,
} from './types';

export function ClientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OidcClientStatus | ''>('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const query = useClientsList({
    q: debouncedSearch || undefined,
    status: status || undefined,
  });

  const paged = usePagedList(query, `${debouncedSearch}|${status}`);
  const clients = paged.items ?? [];
  const isPageLoading = paged.items === undefined && !query.isError;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="mt-1 text-sm text-muted">
            Configure redirect URIs, scopes, claims, and token policy.
          </p>
        </div>
        <Link
          to="/clients/new"
          className="flex items-center gap-1.5 rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create client
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
            placeholder="Search client ID, name, or owner"
            aria-label="Search clients"
            className={`${inputClass} w-full pl-9`}
          />
        </div>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as OidcClientStatus | '')
          }
          aria-label="Filter by status"
          className={inputClass}
        >
          <option value="">All statuses</option>
          {CLIENT_STATUSES.map((value) => (
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
              <th className="px-4 py-3 font-semibold">Client ID</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Secret</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {isPageLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Loading clients…
                </td>
              </tr>
            ) : null}
            {query.isError ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-danger">Could not load clients.</span>{' '}
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
            {!isPageLoading && !query.isError && clients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  No clients match.{' '}
                  <Link to="/clients/new" className="font-semibold text-accent">
                    Register the first one
                  </Link>
                </td>
              </tr>
            ) : null}
            {clients.map((client) => (
              <tr
                key={client.id}
                onClick={() => void navigate(`/clients/${client.id}`)}
                className="cursor-pointer border-b border-line last:border-b-0 hover:bg-row-hover"
              >
                <td className="px-4 py-3 font-mono text-xs">
                  <Link
                    to={`/clients/${client.id}`}
                    className="hover:text-accent"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {client.clientId}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium">{client.name}</td>
                <td className="px-4 py-3 text-muted">{client.type}</td>
                <td className="px-4 py-3 text-muted">
                  {client.hasSecret ? 'set' : '—'}
                </td>
                <td className="px-4 py-3 text-muted">
                  {client.ownerTeam ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    label={client.status}
                    tone={clientStatusTone(client.status)}
                  />
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatDate(client.createdAt)}
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
