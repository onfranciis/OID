import { CreateInternalIdFoundation1718107200000 } from './1718107200000-create-internal-id-foundation';
import { AddUpstreamRefreshTokenCiphertext1718108100000 } from './1718108100000-add-upstream-refresh-token-ciphertext';
import { AlignBetterAuthOauthProviderSchema1718109000000 } from './1718109000000-align-better-auth-oauth-provider-schema';
import { RepointBetterAuthOauthProviderClientFks1718109100000 } from './1718109100000-repoint-better-auth-oauth-provider-client-fks';
import { CreateUserInvites1718110000000 } from './1718110000000-create-user-invites';
import { CreatePasswordResets1718111000000 } from './1718111000000-create-password-resets';

export const DATABASE_MIGRATIONS = [
  CreateInternalIdFoundation1718107200000,
  AddUpstreamRefreshTokenCiphertext1718108100000,
  AlignBetterAuthOauthProviderSchema1718109000000,
  RepointBetterAuthOauthProviderClientFks1718109100000,
  CreateUserInvites1718110000000,
  CreatePasswordResets1718111000000,
] as const;
