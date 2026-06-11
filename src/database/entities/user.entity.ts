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
import { GroupMembershipEntity } from './group-membership.entity';
import { OidcAuthorizationCodeEntity } from './oidc-authorization-code.entity';
import { OidcProviderSessionEntity } from './oidc-provider-session.entity';
import { OidcRefreshTokenEntity } from './oidc-refresh-token.entity';

export enum UserProfileType {
  EMPLOYEE = 'employee',
  CONTRACTOR = 'contractor',
  SERVICE = 'service',
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DEACTIVATED = 'deactivated',
}

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  email!: string;

  @Index('uq_users_normalized_email', { unique: true })
  @Column({ name: 'normalized_email', type: 'text' })
  normalizedEmail!: string;

  @Column({
    name: 'email_verified_at',
    type: 'timestamptz',
    nullable: true,
  })
  emailVerifiedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  username!: string | null;

  @Index('uq_users_normalized_username', { unique: true })
  @Column({ name: 'normalized_username', type: 'text', nullable: true })
  normalizedUsername!: string | null;

  @Column({ name: 'display_name', type: 'text' })
  displayName!: string;

  @Column({ name: 'given_name', type: 'text', nullable: true })
  givenName!: string | null;

  @Column({ name: 'family_name', type: 'text', nullable: true })
  familyName!: string | null;

  @Column({
    name: 'profile_type',
    type: 'enum',
    enum: UserProfileType,
    default: UserProfileType.EMPLOYEE,
  })
  profileType!: UserProfileType;

  @Column({
    type: 'enum',
    enum: UserStatus,
  })
  status!: UserStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt!: Date | null;

  @OneToMany(() => GroupMembershipEntity, (membership) => membership.user)
  groupMemberships!: GroupMembershipEntity[];

  @OneToMany(() => GroupMembershipEntity, (membership) => membership.createdBy)
  createdMemberships!: GroupMembershipEntity[];

  @OneToMany(() => OidcProviderSessionEntity, (session) => session.user)
  providerSessions!: OidcProviderSessionEntity[];

  @OneToMany(() => OidcAuthorizationCodeEntity, (code) => code.user)
  authorizationCodes!: OidcAuthorizationCodeEntity[];

  @OneToMany(() => OidcRefreshTokenEntity, (refreshToken) => refreshToken.user)
  refreshTokens!: OidcRefreshTokenEntity[];

  @OneToMany(() => AuditEventEntity, (auditEvent) => auditEvent.actorUser)
  actorAuditEvents!: AuditEventEntity[];

  @OneToMany(() => AuditEventEntity, (auditEvent) => auditEvent.targetUser)
  targetAuditEvents!: AuditEventEntity[];
}
