import { describe, expect, it } from 'vitest';
import {
  assertSupportedAuthorizationRequest,
  assertSupportedTokenRequest,
  blockDynamicClientRegistration,
} from './better-auth.guardrails';

describe('better auth guardrails', () => {
  it('accepts authorization code requests with S256 PKCE', () => {
    expect(() =>
      assertSupportedAuthorizationRequest({
        response_type: 'code',
        state: 'opaque-state',
        code_challenge: 'opaque-challenge',
        code_challenge_method: 'S256',
      }),
    ).not.toThrow();
  });

  it('rejects unsupported authorization response types', () => {
    expect(() =>
      assertSupportedAuthorizationRequest({
        response_type: 'token',
        state: 'opaque-state',
        code_challenge: 'opaque-challenge',
        code_challenge_method: 'S256',
      }),
    ).toThrow(/response_type=code/);
  });

  it('rejects plain PKCE', () => {
    expect(() =>
      assertSupportedAuthorizationRequest({
        response_type: 'code',
        state: 'opaque-state',
        code_challenge: 'opaque-challenge',
        code_challenge_method: 'plain',
      }),
    ).toThrow(/S256/);
  });

  it('accepts supported token grants', () => {
    expect(() =>
      assertSupportedTokenRequest({
        grant_type: 'authorization_code',
      }),
    ).not.toThrow();
  });

  it('rejects unsupported token grants', () => {
    expect(() =>
      assertSupportedTokenRequest({
        grant_type: 'client_credentials',
      }),
    ).toThrow(/authorization_code and refresh_token/);
  });

  it('blocks dynamic client registration', () => {
    expect(() => blockDynamicClientRegistration()).toThrow(
      /Dynamic client registration/,
    );
  });
});
