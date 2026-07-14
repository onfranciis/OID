import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SEGMENT_TITLES: Record<string, string> = {
  '': 'Overview',
  users: 'Users',
  groups: 'Groups',
  clients: 'Clients',
  audit: 'Audit',
};

// Derives a page title from the top-level route so the browser tab and screen
// readers announce the active section. Detail/new routes fall back to the
// section name.
export function useDocumentTitle(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    const segment = pathname.replace(/^\//, '').split('/')[0];
    const section = SEGMENT_TITLES[segment] ?? 'Admin';

    document.title = `${section} · Internal ID Admin`;
  }, [pathname]);
}
