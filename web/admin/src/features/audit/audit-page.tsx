import { Filter, RefreshCw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TablePagination } from '../../components/table-pagination';
import { inputClass } from '../../components/form-field';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime } from '../../lib/format';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { usePagedList } from '../../lib/use-paged-list';
import { useAuditEvents } from './api';
import {
  AUDIT_SEVERITIES,
  auditSeverityTone,
  type AuditEvent,
  type AuditFilters,
  type AuditSeverity,
} from './types';

const FILTER_KEYS = [
  'eventType',
  'severity',
  'actorUserId',
  'targetUserId',
  'clientId',
] as const;

export function AuditPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const paramsString = searchParams.toString();
  const debouncedParamsString = useDebouncedValue(paramsString, 300);

  const filters = useMemo<AuditFilters>(() => {
    const params = new URLSearchParams(debouncedParamsString);
    const limit = Number(params.get('limit'));

    return {
      eventType: params.get('eventType') ?? undefined,
      severity: (params.get('severity') as AuditSeverity | null) ?? undefined,
      actorUserId: params.get('actorUserId') ?? undefined,
      targetUserId: params.get('targetUserId') ?? undefined,
      clientId: params.get('clientId') ?? undefined,
      limit: Number.isInteger(limit) && limit > 0 ? limit : 50,
    };
  }, [debouncedParamsString]);

  const query = useAuditEvents(filters);
  const paged = usePagedList(query, debouncedParamsString);
  const events = paged.items ?? [];
  const isPageLoading = paged.items === undefined && !query.isError;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }

    setSearchParams(next, { replace: true });
  };

  const hasFilters = FILTER_KEYS.some((key) => searchParams.get(key));

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Audit</h1>
          <p className="mt-1 text-sm text-muted">
            Review security-sensitive identity events.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="flex items-center gap-1.5 rounded-card border border-line bg-surface px-4 py-2 text-sm font-semibold text-accent hover:border-accent"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div className="mt-6 grid gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Event type</span>
          <div className="relative">
            <Filter
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              value={searchParams.get('eventType') ?? ''}
              onChange={(event) => setParam('eventType', event.target.value)}
              placeholder="admin.user"
              className={`${inputClass} w-full pl-9`}
            />
          </div>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Severity</span>
          <select
            value={searchParams.get('severity') ?? ''}
            onChange={(event) => setParam('severity', event.target.value)}
            className={inputClass}
          >
            <option value="">All</option>
            {AUDIT_SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Actor user ID</span>
          <input
            value={searchParams.get('actorUserId') ?? ''}
            onChange={(event) => setParam('actorUserId', event.target.value)}
            className={`${inputClass} font-mono`}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Target user ID</span>
          <input
            value={searchParams.get('targetUserId') ?? ''}
            onChange={(event) => setParam('targetUserId', event.target.value)}
            className={`${inputClass} font-mono`}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Client record ID</span>
          <input
            value={searchParams.get('clientId') ?? ''}
            onChange={(event) => setParam('clientId', event.target.value)}
            className={`${inputClass} font-mono`}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Limit</span>
          <select
            value={searchParams.get('limit') ?? '50'}
            onChange={(event) => setParam('limit', event.target.value)}
            className={inputClass}
          >
            {[50, 100, 200].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        {hasFilters ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="button"
              onClick={() => setSearchParams({}, { replace: true })}
              className="flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear filters
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-160 border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted uppercase">
              <th className="px-4 py-3 font-semibold">Time</th>
              <th className="px-4 py-3 font-semibold">Event</th>
              <th className="px-4 py-3 font-semibold">Severity</th>
              <th className="px-4 py-3 font-semibold">Actor</th>
              <th className="px-4 py-3 font-semibold">Target</th>
              <th className="px-4 py-3 font-semibold">Client</th>
            </tr>
          </thead>
          <tbody>
            {isPageLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Loading events…
                </td>
              </tr>
            ) : null}
            {query.isError ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-danger">Could not load events.</span>{' '}
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
            {!isPageLoading && !query.isError && events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No events match these filters.
                </td>
              </tr>
            ) : null}
            {events.map((event) => (
              <AuditRow key={event.id} event={event} />
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

function AuditRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        onClick={() => setExpanded((value) => !value)}
        className="cursor-pointer border-b border-line last:border-b-0 hover:bg-row-hover"
      >
        <td className="px-4 py-3 whitespace-nowrap text-muted">
          {formatDateTime(event.createdAt)}
        </td>
        <td className="px-4 py-3 font-mono text-xs">{event.eventType}</td>
        <td className="px-4 py-3">
          <StatusBadge
            label={event.severity}
            tone={auditSeverityTone(event.severity)}
          />
        </td>
        <td className="px-4 py-3 font-mono text-xs text-muted">
          {event.actorUserId ?? '—'}
        </td>
        <td className="px-4 py-3 font-mono text-xs text-muted">
          {event.targetUserId ?? '—'}
        </td>
        <td className="px-4 py-3 font-mono text-xs text-muted">
          {event.clientId ?? '—'}
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-line bg-row-hover">
          <td colSpan={6} className="px-4 py-3">
            <dl className="grid gap-2 text-xs">
              <div>
                <dt className="text-muted uppercase">IP address</dt>
                <dd className="font-mono">{event.ipAddress ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted uppercase">User agent</dt>
                <dd className="font-mono break-all">
                  {event.userAgent ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted uppercase">Metadata</dt>
                <dd>
                  <pre className="mt-1 overflow-x-auto rounded-card border border-line bg-surface p-3 font-mono">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </dd>
              </div>
            </dl>
          </td>
        </tr>
      ) : null}
    </>
  );
}
