import { AuditSeverity } from '../database/entities/audit-event.entity';

export const AuditEventTypes = {
  AdminClientCreated: 'admin.client.created',
  AdminClientRedirectUriAdded: 'admin.client.redirect_uri_added',
  AdminClientRedirectUriRemoved: 'admin.client.redirect_uri_removed',
  AdminClientStatusChanged: 'admin.client.status_changed',
  AdminClientUpdated: 'admin.client.updated',
  AdminGroupCreated: 'admin.group.created',
  AdminGroupMembershipAdded: 'admin.group.membership_added',
  AdminGroupMembershipRemoved: 'admin.group.membership_removed',
  AdminGroupUpdated: 'admin.group.updated',
  AdminUserCreated: 'admin.user.created',
  AdminUserStatusChanged: 'admin.user.status_changed',
  AdminUserUpdated: 'admin.user.updated',
  ClientRegistrationBlocked: 'client.registration.blocked',
  ClientSecretRotated: 'client.secret.rotated',
  OidcAuthorizationCodeIssued: 'oidc.authorization_code.issued',
  OidcAuthorizeRequestAccepted: 'oidc.authorize.request.accepted',
  OidcAuthorizeRequestRejected: 'oidc.authorize.request.rejected',
  OidcRefreshTokenReplayDetected: 'oidc.refresh_token.replay_detected',
  OidcRefreshTokenRevoked: 'oidc.refresh_token.revoked',
  OidcRefreshTokenRotated: 'oidc.refresh_token.rotated',
  OidcTokenIssued: 'oidc.token.issued',
  OidcTokenRequestAccepted: 'oidc.token.request.accepted',
  OidcTokenRequestRejected: 'oidc.token.request.rejected',
  ProviderSessionIssued: 'provider.session.issued',
  UserLoginRejected: 'user.login.rejected',
  UserLoginSucceeded: 'user.login.succeeded',
  UserLogoutSucceeded: 'user.logout.succeeded',
} as const;

export type AuditEventType =
  (typeof AuditEventTypes)[keyof typeof AuditEventTypes];

export interface AuditEventRecordInput {
  eventType: AuditEventType;
  severity: AuditSeverity;
  actorUserId?: string | null;
  targetUserId?: string | null;
  clientId?: string | null;
  providerSessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}
