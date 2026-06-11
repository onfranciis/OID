import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { OidcClientEntity } from './oidc-client.entity';
import { OidcProviderSessionEntity } from './oidc-provider-session.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'refresh_tokens' })
export class OidcRefreshTokenEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Index('uq_refresh_tokens_token_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'text' })
  tokenHash!: string;

  @Column({ name: 'user_id', type: 'text' })
  userId!: string;

  @Column({ name: 'client_id', type: 'text' })
  clientId!: string;

  @Column({ name: 'provider_session_id', type: 'text', nullable: true })
  providerSessionId!: string | null;

  @Column({ name: 'parent_token_id', type: 'text', nullable: true })
  parentTokenId!: string | null;

  @Column({ name: 'rotated_to_token_id', type: 'text', nullable: true })
  rotatedToTokenId!: string | null;

  @Index('idx_refresh_tokens_family_id')
  @Column({ name: 'family_id', type: 'text' })
  familyId!: string;

  @Column({ name: 'issued_at', type: 'timestamptz' })
  issuedAt!: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @Index('idx_refresh_tokens_idle_expires_at')
  @Column({ name: 'idle_expires_at', type: 'timestamptz' })
  idleExpiresAt!: Date;

  @Index('idx_refresh_tokens_absolute_expires_at')
  @Column({ name: 'absolute_expires_at', type: 'timestamptz' })
  absoluteExpiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'revocation_reason', type: 'text', nullable: true })
  revocationReason!: string | null;

  @ManyToOne(() => UserEntity, (user) => user.refreshTokens, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @ManyToOne(() => OidcClientEntity, (client) => client.refreshTokens, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'client_id' })
  client!: OidcClientEntity;

  @ManyToOne(
    () => OidcProviderSessionEntity,
    (providerSession) => providerSession.refreshTokens,
    {
      onDelete: 'SET NULL',
      nullable: true,
    },
  )
  @JoinColumn({ name: 'provider_session_id' })
  providerSession!: OidcProviderSessionEntity | null;

  @ManyToOne(() => OidcRefreshTokenEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_token_id' })
  parentToken!: OidcRefreshTokenEntity | null;

  @OneToOne(() => OidcRefreshTokenEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'rotated_to_token_id' })
  rotatedToToken!: OidcRefreshTokenEntity | null;
}
