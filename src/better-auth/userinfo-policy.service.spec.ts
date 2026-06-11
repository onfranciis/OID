import { describe, expect, it } from 'vitest';
import { filterUserInfoPayload } from './userinfo-policy.service';

describe('filterUserInfoPayload', () => {
  it('keeps only claims allowed by scopes and client policy', () => {
    expect(
      filterUserInfoPayload(
        {
          sub: 'usr_123',
          email: 'admin@company.com',
          email_verified: true,
          name: 'Internal Admin',
          given_name: 'Internal',
          family_name: 'Admin',
          preferred_username: 'internal.admin',
          profile_type: 'employee',
          groups: ['identity-admins'],
        },
        {
          clientId: 'internal-id-client',
          scopes: ['openid', 'email', 'groups'],
          allowedClaims: ['email', 'email_verified', 'groups'],
        },
      ),
    ).toEqual({
      sub: 'usr_123',
      email: 'admin@company.com',
      email_verified: true,
      groups: ['identity-admins'],
    });
  });

  it('falls back to sub only when no token context is available', () => {
    expect(
      filterUserInfoPayload(
        {
          sub: 'usr_123',
          email: 'admin@company.com',
          groups: ['identity-admins'],
        },
        null,
      ),
    ).toEqual({
      sub: 'usr_123',
    });
  });
});
