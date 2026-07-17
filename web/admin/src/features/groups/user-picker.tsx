import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { inputClass } from '../../components/form-field';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { useUsersList } from '../users/api';

// Search-driven picker for adding a member to a group. Excludes users already
// in the group and surfaces the top matches for the current query.
export function UserPicker({
  excludeIds,
  disabled,
  onPick,
}: {
  excludeIds: Set<string>;
  disabled?: boolean;
  onPick: (userId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const query = useUsersList({ q: debouncedSearch || undefined });

  const candidates =
    query.data?.pages
      .flatMap((page) => page.items)
      .filter((user) => !excludeIds.has(user.id))
      .slice(0, 8) ?? [];

  return (
    <div>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search users to add"
          aria-label="Search users to add"
          className={`${inputClass} w-full pl-9`}
        />
      </div>
      {debouncedSearch ? (
        <ul className="mt-2 grid gap-1">
          {candidates.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">No matching users.</li>
          ) : null}
          {candidates.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onPick(user.id);
                  setSearch('');
                }}
                className="flex w-full items-center justify-between gap-3 rounded-card border border-line px-3 py-2 text-left text-sm hover:border-accent disabled:opacity-50"
              >
                <span>
                  <span className="font-medium">{user.displayName}</span>{' '}
                  <span className="text-xs text-muted">{user.email}</span>
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-accent">
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
