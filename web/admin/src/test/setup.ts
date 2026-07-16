import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { resetMockDb } from '../mocks/handlers';
import { server } from '../mocks/server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(async () => {
  cleanup();
  server.resetHandlers();
  resetMockDb();
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
