import { AuditEventEntity } from './audit-event.entity';
import { GroupMembershipEntity } from './group-membership.entity';
import { GroupEntity } from './group.entity';
import { OidcAuthorizationCodeEntity } from './oidc-authorization-code.entity';
import { OidcClientEntity } from './oidc-client.entity';
import { OidcPostLogoutRedirectUriEntity } from './oidc-post-logout-redirect-uri.entity';
import { OidcProviderSessionEntity } from './oidc-provider-session.entity';
import { OidcRedirectUriEntity } from './oidc-redirect-uri.entity';
import { OidcRefreshTokenEntity } from './oidc-refresh-token.entity';
import { PasswordResetEntity } from './password-reset.entity';
import { SigningKeyEntity } from './signing-key.entity';
import { UserInviteEntity } from './user-invite.entity';
import { UserEntity } from './user.entity';

export const DATABASE_ENTITIES = [
  AuditEventEntity,
  GroupMembershipEntity,
  GroupEntity,
  OidcAuthorizationCodeEntity,
  OidcClientEntity,
  OidcPostLogoutRedirectUriEntity,
  OidcProviderSessionEntity,
  OidcRedirectUriEntity,
  OidcRefreshTokenEntity,
  PasswordResetEntity,
  SigningKeyEntity,
  UserInviteEntity,
  UserEntity,
] as const;
