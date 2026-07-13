import { http, HttpResponse } from 'msw';
import type { SessionInfo } from '../app/session';

// Executable specification of the assumed /admin/api/* contract
// (docs/ADMIN_API_CONTRACT.md). Handlers grow with each phase; the backend
// B-07 work must satisfy the same shapes.

export const mockSession: SessionInfo = {
  user: {
    id: 'usr_01mockadmin0000000000000000',
    displayName: 'Internal ID Administrator',
    email: 'admin@company.com',
  },
  isAdmin: true,
  csrfToken: 'mock-nonce.mock-signature',
};

export const handlers = [
  http.get('/admin/api/session', () => HttpResponse.json(mockSession)),
];
