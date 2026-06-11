import { describe, expect, it } from 'vitest';
import { buildAllowedAdditionalClaims } from './claim-policy';

describe('buildAllowedAdditionalClaims', () => {
  it('returns only the allowed claims for the requested scopes', () => {
    expect(
      buildAllowedAdditionalClaims(
        ['preferred_username', 'groups', 'profile_type'],
        ['openid', 'profile', 'groups'],
        {
          username: 'internal.admin',
          profileType: 'employee',
          groups: ['engineering', 'identity-admins'],
        },
      ),
    ).toEqual({
      preferred_username: 'internal.admin',
      profile_type: 'employee',
      groups: ['engineering', 'identity-admins'],
    });
  });

  it('omits claims that are not allowed by client policy', () => {
    expect(
      buildAllowedAdditionalClaims(
        ['preferred_username'],
        ['openid', 'profile', 'groups'],
        {
          username: 'internal.admin',
          profileType: 'employee',
          groups: ['engineering'],
        },
      ),
    ).toEqual({
      preferred_username: 'internal.admin',
    });
  });

  it('omits claims whose supporting scopes were not requested', () => {
    expect(
      buildAllowedAdditionalClaims(
        ['preferred_username', 'groups', 'profile_type'],
        ['openid'],
        {
          username: 'internal.admin',
          profileType: 'employee',
          groups: ['engineering'],
        },
      ),
    ).toEqual({});
  });
});
