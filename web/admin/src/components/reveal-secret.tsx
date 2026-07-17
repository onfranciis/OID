import { Check, Copy, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

// One-time secret display. The value is shown once after rotation, offered for
// copy, then dismissed and never rendered again (never persisted or cached).
export function RevealSecret({
  secret,
  onDismiss,
}: {
  secret: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(secret).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <div className="rounded-card border border-warning/40 bg-warning/10 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-warning">
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        Copy this secret now. It is shown only once and cannot be retrieved
        again.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="flex-1 rounded-card border border-line bg-surface px-3 py-2 font-mono text-sm break-all">
          {secret}
        </code>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-card border border-accent/40 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="mt-3 text-right">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-card bg-accent px-4 py-2 text-sm font-semibold text-surface hover:opacity-90"
        >
          Done
        </button>
      </div>
    </div>
  );
}
