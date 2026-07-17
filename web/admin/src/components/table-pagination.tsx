export function TablePagination({
  pageNumber,
  hasPreviousPage,
  hasNextPage,
  isFetchingNextPage,
  onPrevious,
  onNext,
}: {
  pageNumber: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  isFetchingNextPage?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  // A single page needs no controls at all.
  if (!hasPreviousPage && !hasNextPage) {
    return null;
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <button
        type="button"
        disabled={!hasPreviousPage}
        onClick={onPrevious}
        className="rounded-card border border-line bg-surface px-3 py-2 text-sm font-semibold text-accent hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        Previous
      </button>
      <span className="text-sm text-muted">Page {pageNumber}</span>
      <button
        type="button"
        disabled={!hasNextPage || isFetchingNextPage}
        onClick={onNext}
        className="rounded-card border border-line bg-surface px-3 py-2 text-sm font-semibold text-accent hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isFetchingNextPage ? 'Loading…' : 'Next'}
      </button>
    </div>
  );
}
