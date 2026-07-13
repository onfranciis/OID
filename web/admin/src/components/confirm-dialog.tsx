import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState, type ReactNode } from 'react';

// Reusable confirmation dialog for destructive actions. When
// `typedConfirmation` is set (self-lockout guards), the confirm button stays
// disabled until the admin types the exact value.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = 'default',
  typedConfirmation,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  typedConfirmation?: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const [typedValue, setTypedValue] = useState('');

  useEffect(() => {
    if (!open) {
      setTypedValue('');
    }
  }, [open]);

  const confirmDisabled =
    pending ||
    (typedConfirmation !== undefined && typedValue !== typedConfirmation);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-card border border-line bg-surface p-6 font-sans text-ink shadow-lg">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="mt-2 text-sm text-muted">{description}</div>
          </Dialog.Description>
          {typedConfirmation !== undefined ? (
            <label className="mt-4 grid gap-1 text-sm">
              <span className="text-muted">
                Type <code className="font-mono">{typedConfirmation}</code> to
                confirm.
              </span>
              <input
                value={typedValue}
                onChange={(event) => setTypedValue(event.target.value)}
                placeholder={typedConfirmation}
                className="rounded-card border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>
          ) : null}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-card border border-line px-4 py-2 text-sm text-muted hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={confirmDisabled}
              onClick={onConfirm}
              className={`rounded-card px-4 py-2 text-sm font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-50 ${
                tone === 'danger'
                  ? 'bg-danger hover:opacity-90'
                  : 'bg-accent hover:opacity-90'
              }`}
            >
              {pending ? 'Working…' : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
