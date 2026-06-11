import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { AuditEventEntity } from './audit-event.entity';
import { OidcAuthorizationCodeEntity } from './oidc-authorization-code.entity';
import { OidcRefreshTokenEntity } from './oidc-refresh-token.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'provider_sessions' })
export class OidcProviderSessionEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'user_id', type: 'text' })
  userId!: string;

  @Index('uq_provider_sessions_session_hash', { unique: true })
  @Column({ name: 'session_hash', type: 'text' })
  sessionHash!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt!: Date;

  @Column({ name: 'auth_time', type: 'timestamptz' })
  authTime!: Date;

  @Index('idx_provider_sessions_idle_expires_at')
  @Column({ name: 'idle_expires_at', type: 'timestamptz' })
  idleExpiresAt!: Date;

  @Index('idx_provider_sessions_absolute_expires_at')
  @Column({ name: 'absolute_expires_at', type: 'timestamptz' })
  absoluteExpiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'revocation_reason', type: 'text', nullable: true })
  revocationReason!: string | null;

  @Column({ name: 'ip_address', type: 'text', nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @ManyToOne(() => UserEntity, (user) => user.providerSessions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @OneToMany(() => OidcAuthorizationCodeEntity, (code) => code.providerSession)
  authorizationCodes!: OidcAuthorizationCodeEntity[];

  @OneToMany(
    () => OidcRefreshTokenEntity,
    (refreshToken) => refreshToken.providerSession,
  )
  refreshTokens!: OidcRefreshTokenEntity[];

  @OneToMany(() => AuditEventEntity, (auditEvent) => auditEvent.providerSession)
  auditEvents!: AuditEventEntity[];
}
