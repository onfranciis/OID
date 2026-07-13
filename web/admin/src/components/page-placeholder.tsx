// Placeholder for sections whose phase has not shipped yet. Each feature
// replaces its placeholder when its phase lands (F2 onward).
export function PagePlaceholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">{description}</p>
      <p className="mt-6 inline-block rounded-card border border-line bg-surface px-3 py-2 text-sm text-muted">
        This section arrives in Phase {phase}.
      </p>
    </section>
  );
}
