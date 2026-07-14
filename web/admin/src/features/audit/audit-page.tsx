import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { inputClass } from '../../components/form-field';
import { StatusBadge } from '../../components/status-badge';
import { formatDateTime } from '../../lib/format';
import { useDebouncedValue } from '../../lib/use-debounced-value';
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

  // Filters are driven by the URL so other sections can deep-link
  // (e.g. /audit?targetUserId=usr_...). Debounce the serialized params so
  // typing does not fire a request per keystroke.
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
  const events = query.data ?? [];

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
          className="rounded-card border border-line bg-surface px-4 py-2 text-sm font-semibold text-accent hover:border-accent"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 grid gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Event type</span>
          <input
            value={searchParams.get('eventType') ?? ''}
            onChange={(event) => setParam('eventType', event.target.value)}
            placeholder="admin.user"
            className={inputClass}
          />
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
              className="text-sm font-semibold text-accent hover:underline"
            >
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
            {query.isPending ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Loading events…
                </td>
              </tr>
            ) : null}
            {query.isError ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <span className="text-danger">Could not load events.</span>{' '}
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
            {query.isSuccess && events.length === 0 ? (
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
    </section>
  );
}

function AuditRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        onClick={() => setExpanded((value) => !value)}
        className="cursor-pointer border-b border-line last:border-b-0 hover:bg-page"
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
        <tr className="border-b border-line bg-page">
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
