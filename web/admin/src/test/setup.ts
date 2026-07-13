import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { setCsrfToken } from '../app/api-client';
import { resetMockDb } from '../mocks/handlers';
import { server } from '../mocks/server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockDb();
  setCsrfToken(null);
});

afterAll(() => {
  server.close();
});
