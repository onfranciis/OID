import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { OidcClientEntity } from './oidc-client.entity';
import { OidcProviderSessionEntity } from './oidc-provider-session.entity';
import { UserEntity } from './user.entity';

export enum PkceChallengeMethod {
  S256 = 'S256',
}

@Entity({ name: 'authorization_codes' })
export class OidcAuthorizationCodeEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Index('uq_authorization_codes_code_hash', { unique: true })
  @Column({ name: 'code_hash', type: 'text' })
  codeHash!: string;

  @Column({ name: 'client_id', type: 'text' })
  clientId!: string;

  @Column({ name: 'user_id', type: 'text' })
  userId!: string;

  @Column({ name: 'provider_session_id', type: 'text' })
  providerSessionId!: string;

  @Column({ name: 'redirect_uri', type: 'text' })
  redirectUri!: string;

  @Column({ type: 'text' })
  scope!: string;

  @Column({ name: 'code_challenge', type: 'text' })
  codeChallenge!: string;

  @Column({
    name: 'code_challenge_method',
    type: 'enum',
    enum: PkceChallengeMethod,
  })
  codeChallengeMethod!: PkceChallengeMethod;

  @Column({ type: 'text', nullable: true })
  nonce!: string | null;

  @Column({ name: 'auth_time', type: 'timestamptz' })
  authTime!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Index('idx_authorization_codes_expires_at')
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Index('idx_authorization_codes_consumed_at')
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @ManyToOne(() => OidcClientEntity, (client) => client.authorizationCodes, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'client_id' })
  client!: OidcClientEntity;

  @ManyToOne(() => UserEntity, (user) => user.authorizationCodes, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @ManyToOne(
    () => OidcProviderSessionEntity,
    (providerSession) => providerSession.authorizationCodes,
    {
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({ name: 'provider_session_id' })
  providerSession!: OidcProviderSessionEntity;
}
