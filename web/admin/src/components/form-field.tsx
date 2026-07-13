import type { ReactNode } from 'react';

export const inputClass =
  'rounded-card border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent';

export function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}
