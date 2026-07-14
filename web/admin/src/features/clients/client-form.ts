import { z } from 'zod';
import type {
  AdminCreateClientInput,
  AdminUpdateClientInput,
  ClientDetail,
} from './types';

// Positive-integer TTLs and the refresh-token policy mirror
// AdminClientService: refresh TTL fields are only meaningful when refresh
// tokens are allowed.
const positiveInt = z
  .number({ message: 'Enter a positive number of seconds.' })
  .int('Must be a whole number.')
  .positive('Must be greater than zero.');

// Base object kept separate from the refinement so the create schema can extend
// it with clientId/type before both apply the same refresh-policy check
// (a refined schema is a ZodEffects and can no longer be extended).
const clientPolicyObject = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  ownerTeam: z.string().trim(),
  allowedScopes: z.array(z.string()).min(1, 'At least one scope is required.'),
  allowedClaims: z.array(z.string()).min(1, 'At least one claim is required.'),
  requirePkce: z.boolean(),
  allowRefreshTokens: z.boolean(),
  accessTokenTtlSeconds: positiveInt,
  idTokenTtlSeconds: positiveInt,
  refreshTokenIdleTtlSeconds: positiveInt.nullable(),
  refreshTokenAbsoluteTtlSeconds: positiveInt.nullable(),
});

function refineRefreshPolicy(
  values: { allowRefreshTokens: boolean } & Record<string, unknown>,
  ctx: z.RefinementCtx,
): void {
  if (!values.allowRefreshTokens) {
    return;
  }

  if (values.refreshTokenIdleTtlSeconds === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['refreshTokenIdleTtlSeconds'],
      message: 'Required when refresh tokens are allowed.',
    });
  }

  if (values.refreshTokenAbsoluteTtlSeconds === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['refreshTokenAbsoluteTtlSeconds'],
      message: 'Required when refresh tokens are allowed.',
    });
  }
}

export const clientPolicySchema =
  clientPolicyObject.superRefine(refineRefreshPolicy);

export type ClientPolicyValues = z.infer<typeof clientPolicySchema>;

export const clientCreateSchema = clientPolicyObject
  .extend({
    clientId: z.string().trim().min(1, 'Client ID is required.'),
    type: z.enum(['confidential', 'public']),
  })
  .superRefine(refineRefreshPolicy);

export type ClientCreateValues = z.infer<typeof clientCreateSchema>;

export const DEFAULT_POLICY_VALUES: ClientPolicyValues = {
  name: '',
  ownerTeam: '',
  allowedScopes: ['openid'],
  allowedClaims: ['sub'],
  requirePkce: true,
  allowRefreshTokens: false,
  accessTokenTtlSeconds: 900,
  idTokenTtlSeconds: 900,
  refreshTokenIdleTtlSeconds: 60 * 60 * 24 * 7,
  refreshTokenAbsoluteTtlSeconds: 60 * 60 * 24 * 30,
};

function toPolicyInput(values: ClientPolicyValues) {
  return {
    name: values.name,
    ownerTeam: values.ownerTeam || null,
    allowedScopes: values.allowedScopes,
    allowedClaims: values.allowedClaims,
    requirePkce: values.requirePkce,
    allowRefreshTokens: values.allowRefreshTokens,
    accessTokenTtlSeconds: values.accessTokenTtlSeconds,
    idTokenTtlSeconds: values.idTokenTtlSeconds,
    refreshTokenIdleTtlSeconds: values.allowRefreshTokens
      ? values.refreshTokenIdleTtlSeconds
      : null,
    refreshTokenAbsoluteTtlSeconds: values.allowRefreshTokens
      ? values.refreshTokenAbsoluteTtlSeconds
      : null,
  };
}

export function toUpdateClientInput(
  values: ClientPolicyValues,
): AdminUpdateClientInput {
  return toPolicyInput(values);
}

export function toCreateClientInput(
  values: ClientCreateValues,
): AdminCreateClientInput {
  return {
    clientId: values.clientId,
    type: values.type,
    ...toPolicyInput(values),
  };
}

export function toPolicyValues(client: ClientDetail): ClientPolicyValues {
  return {
    name: client.name,
    ownerTeam: client.ownerTeam ?? '',
    allowedScopes: client.allowedScopes,
    allowedClaims: client.allowedClaims,
    requirePkce: client.requirePkce,
    allowRefreshTokens: client.allowRefreshTokens,
    accessTokenTtlSeconds: client.accessTokenTtlSeconds,
    idTokenTtlSeconds: client.idTokenTtlSeconds,
    refreshTokenIdleTtlSeconds:
      client.refreshTokenIdleTtlSeconds ??
      DEFAULT_POLICY_VALUES.refreshTokenIdleTtlSeconds,
    refreshTokenAbsoluteTtlSeconds:
      client.refreshTokenAbsoluteTtlSeconds ??
      DEFAULT_POLICY_VALUES.refreshTokenAbsoluteTtlSeconds,
  };
}
