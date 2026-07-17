import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { resetMockDb } from '../mocks/handlers';
import { server } from '../mocks/server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });

  // jsdom does not implement matchMedia; ThemeProvider (src/app/theme.tsx)
  // calls it on every mount. Individual tests can override the return value.
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
  }
});

afterEach(async () => {
  cleanup();
  server.resetHandlers();
  resetMockDb();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  // Imported lazily so this setup file does not eagerly evaluate api-client
  // (and its ./navigation import) before a test file's vi.mock can intercept it.
  const { setCsrfToken, resetLoginRedirect } =
    await import('../app/api-client');
  setCsrfToken(null);
  resetLoginRedirect();
});

afterAll(() => {
  server.close();
});
