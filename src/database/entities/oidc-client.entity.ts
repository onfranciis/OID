import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuditEventEntity } from './audit-event.entity';
import { OidcAuthorizationCodeEntity } from './oidc-authorization-code.entity';
import { OidcPostLogoutRedirectUriEntity } from './oidc-post-logout-redirect-uri.entity';
import { OidcRedirectUriEntity } from './oidc-redirect-uri.entity';
import { OidcRefreshTokenEntity } from './oidc-refresh-token.entity';

export enum OidcClientType {
  CONFIDENTIAL = 'confidential',
  PUBLIC = 'public',
}

export enum OidcClientStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

@Entity({ name: 'oidc_clients' })
export class OidcClientEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Index('uq_oidc_clients_client_id', { unique: true })
  @Column({ name: 'client_id', type: 'text' })
  clientId!: string;

  @Column({ name: 'client_secret_hash', type: 'text', nullable: true })
  clientSecretHash!: string | null;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'enum', enum: OidcClientType })
  type!: OidcClientType;

  @Column({ type: 'enum', enum: OidcClientStatus })
  status!: OidcClientStatus;

  @Column({
    name: 'allowed_scopes',
    type: 'text',
    array: true,
    default: '{}',
  })
  allowedScopes!: string[];

  @Column({
    name: 'allowed_claims',
    type: 'text',
    array: true,
    default: '{}',
  })
  allowedClaims!: string[];

  @Column({ name: 'require_pkce', type: 'boolean', default: true })
  requirePkce!: boolean;

  @Column({
    name: 'allow_refresh_tokens',
    type: 'boolean',
    default: false,
  })
  allowRefreshTokens!: boolean;

  @Column({
    name: 'access_token_ttl_seconds',
    type: 'integer',
    default: 900,
  })
  accessTokenTtlSeconds!: number;

  @Column({
    name: 'id_token_ttl_seconds',
    type: 'integer',
    default: 900,
  })
  idTokenTtlSeconds!: number;

  @Column({
    name: 'refresh_token_idle_ttl_seconds',
    type: 'integer',
    nullable: true,
  })
  refreshTokenIdleTtlSeconds!: number | null;

  @Column({
    name: 'refresh_token_absolute_ttl_seconds',
    type: 'integer',
    nullable: true,
  })
  refreshTokenAbsoluteTtlSeconds!: number | null;

  @Column({ name: 'owner_team', type: 'text', nullable: true })
  ownerTeam!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => OidcRedirectUriEntity, (redirectUri) => redirectUri.client)
  redirectUris!: OidcRedirectUriEntity[];

  @OneToMany(
    () => OidcPostLogoutRedirectUriEntity,
    (redirectUri) => redirectUri.client,
  )
  postLogoutRedirectUris!: OidcPostLogoutRedirectUriEntity[];

  @OneToMany(() => OidcAuthorizationCodeEntity, (code) => code.client)
  authorizationCodes!: OidcAuthorizationCodeEntity[];

  @OneToMany(
    () => OidcRefreshTokenEntity,
    (refreshToken) => refreshToken.client,
  )
  refreshTokens!: OidcRefreshTokenEntity[];

  @OneToMany(() => AuditEventEntity, (auditEvent) => auditEvent.client)
  auditEvents!: AuditEventEntity[];
}
