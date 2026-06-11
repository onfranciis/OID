import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { OidcClientEntity } from './oidc-client.entity';
import { OidcProviderSessionEntity } from './oidc-provider-session.entity';
import { UserEntity } from './user.entity';

export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

@Entity({ name: 'audit_events' })
export class AuditEventEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'event_type', type: 'text' })
  eventType!: string;

  @Column({ type: 'enum', enum: AuditSeverity })
  severity!: AuditSeverity;

  @Column({ name: 'actor_user_id', type: 'text', nullable: true })
  actorUserId!: string | null;

  @Column({ name: 'target_user_id', type: 'text', nullable: true })
  targetUserId!: string | null;

  @Column({ name: 'client_id', type: 'text', nullable: true })
  clientId!: string | null;

  @Column({ name: 'provider_session_id', type: 'text', nullable: true })
  providerSessionId!: string | null;

  @Column({ name: 'ip_address', type: 'text', nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ name: 'metadata_json', type: 'jsonb', nullable: true })
  metadataJson!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => UserEntity, (user) => user.actorAuditEvents, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'actor_user_id' })
  actorUser!: UserEntity | null;

  @ManyToOne(() => UserEntity, (user) => user.targetAuditEvents, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'target_user_id' })
  targetUser!: UserEntity | null;

  @ManyToOne(() => OidcClientEntity, (client) => client.auditEvents, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'client_id' })
  client!: OidcClientEntity | null;

  @ManyToOne(
    () => OidcProviderSessionEntity,
    (providerSession) => providerSession.auditEvents,
    {
      onDelete: 'SET NULL',
      nullable: true,
    },
  )
  @JoinColumn({ name: 'provider_session_id' })
  providerSession!: OidcProviderSessionEntity | null;
}
