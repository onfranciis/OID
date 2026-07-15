export type BadgeTone = 'accent' | 'success' | 'muted' | 'warning' | 'danger';

const toneClasses: Record<BadgeTone, string> = {
  accent: 'border-accent/30 bg-accent/10 text-accent',
  success: 'border-success/30 bg-success/10 text-success',
  muted: 'border-line bg-page text-muted',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger',
};

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: BadgeTone;
}) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}
