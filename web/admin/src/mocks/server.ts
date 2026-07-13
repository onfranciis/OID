import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Node-side MSW server for Vitest; individual tests override handlers with
// server.use(...) to simulate error responses.
export const server = setupServer(...handlers);
