import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-muted">
        This page does not exist in the admin console.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-card border border-line bg-surface px-3 py-2 text-sm font-semibold text-accent hover:border-accent"
      >
        Back to Overview
      </Link>
    </section>
  );
}
