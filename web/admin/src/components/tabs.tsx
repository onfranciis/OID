import { useId, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface TabDef {
  id: string;
  label: string;
  icon?: LucideIcon;
  content: ReactNode;
}

// Lightweight accessible tab set (roving tablist). Kept local to avoid another
// dependency; Radix primitives are reserved for overlays where focus trapping
// matters.
export function Tabs({ tabs }: { tabs: TabDef[] }) {
  const baseId = useId();
  const [active, setActive] = useState(tabs[0]?.id);
  const activeTab = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Client sections"
        className="flex flex-wrap gap-1 border-b border-line"
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeTab?.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              role="tab"
              id={`${baseId}-${tab.id}-tab`}
              aria-selected={selected}
              aria-controls={`${baseId}-${tab.id}-panel`}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`-mb-px flex items-center gap-1.5 rounded-t-card border-b-2 px-4 py-2 text-sm font-semibold ${
                selected
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeTab ? (
        <div
          role="tabpanel"
          id={`${baseId}-${activeTab.id}-panel`}
          aria-labelledby={`${baseId}-${activeTab.id}-tab`}
          className="pt-5"
        >
          {activeTab.content}
        </div>
      ) : null}
    </div>
  );
}
