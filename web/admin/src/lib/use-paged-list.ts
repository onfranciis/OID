import { useEffect, useState } from 'react';

interface PageShape<TItem> {
  items: TItem[];
  nextCursor: string | null;
}

interface PagedListQuery<TItem> {
  data?: { pages: Array<PageShape<TItem>> };
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export interface PagedList<TItem> {
  // undefined only while the current page has not been fetched yet (e.g. right
  // after moving forward into a page that isn't cached).
  items: TItem[] | undefined;
  pageNumber: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
}

// Presents a cursor-paginated TanStack `useInfiniteQuery` as one page at a
// time (Previous/Next) instead of an ever-growing "Load more" list, while
// still reusing its page cache so going back never re-fetches.
export function usePagedList<TItem>(
  query: PagedListQuery<TItem>,
  resetKey: string,
): PagedList<TItem> {
  const [pageIndex, setPageIndex] = useState(0);

  // A new search/filter starts an unrelated set of pages; jump back to page 1.
  useEffect(() => {
    setPageIndex(0);
  }, [resetKey]);

  const pages = query.data?.pages ?? [];
  const hasNextPage = pageIndex + 1 < pages.length || query.hasNextPage;

  const goToNextPage = () => {
    if (pageIndex + 1 < pages.length) {
      setPageIndex(pageIndex + 1);
    } else if (query.hasNextPage) {
      query.fetchNextPage();
      setPageIndex(pageIndex + 1);
    }
  };

  const goToPreviousPage = () => {
    if (pageIndex > 0) {
      setPageIndex(pageIndex - 1);
    }
  };

  return {
    items: pages[pageIndex]?.items,
    pageNumber: pageIndex + 1,
    hasPreviousPage: pageIndex > 0,
    hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    goToPreviousPage,
    goToNextPage,
  };
}
