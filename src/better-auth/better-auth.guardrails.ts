import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';

function getSingleQueryValue(
  value: Request['query'][string],
): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return undefined;
}

function getBodyValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return undefined;
}

export function blockDynamicClientRegistration(): never {
  throw new NotFoundException('Dynamic client registration is not supported.');
}

export function assertSupportedAuthorizationRequest(
  query: Request['query'],
): void {
  const responseType = getSingleQueryValue(query.response_type);
  const state = getSingleQueryValue(query.state);
  const codeChallenge = getSingleQueryValue(query.code_challenge);
  const codeChallengeMethod = getSingleQueryValue(query.code_challenge_method);

  if (responseType !== 'code') {
    throw new BadRequestException(
      'Only response_type=code is supported by Internal ID.',
    );
  }

  if (!state) {
    throw new BadRequestException('state is required.');
  }

  if (!codeChallenge) {
    throw new BadRequestException('PKCE code_challenge is required.');
  }

  if (codeChallengeMethod !== 'S256' && codeChallengeMethod !== 's256') {
    throw new BadRequestException(
      'Only PKCE code_challenge_method=S256 is supported.',
    );
  }
}

export function assertSupportedTokenRequest(body: unknown): void {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException('Token request body is required.');
  }

  const grantType = getBodyValue((body as Record<string, unknown>).grant_type);

  if (grantType !== 'authorization_code' && grantType !== 'refresh_token') {
    throw new BadRequestException(
      'Only authorization_code and refresh_token grants are supported.',
    );
  }
}
