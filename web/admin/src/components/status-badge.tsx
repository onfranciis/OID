export type BadgeTone = 'accent' | 'muted' | 'warning' | 'danger';

const toneClasses: Record<BadgeTone, string> = {
  accent: 'border-accent/30 bg-accent/10 text-accent',
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
      className={`inline-block rounded-card border px-2 py-0.5 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}
