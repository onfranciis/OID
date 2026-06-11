import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

export enum SigningKeyStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  RETIRING = 'retiring',
  RETIRED = 'retired',
  COMPROMISED = 'compromised',
}

@Entity({ name: 'signing_keys' })
export class SigningKeyEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Index('uq_signing_keys_kid', { unique: true })
  @Column({ type: 'text' })
  kid!: string;

  @Column({ type: 'text' })
  algorithm!: string;

  @Column({ name: 'public_jwk', type: 'jsonb' })
  publicJwk!: Record<string, unknown>;

  @Column({ name: 'encrypted_private_key', type: 'text' })
  encryptedPrivateKey!: string;

  @Column({ type: 'enum', enum: SigningKeyStatus })
  status!: SigningKeyStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt!: Date | null;

  @Column({ name: 'retired_at', type: 'timestamptz', nullable: true })
  retiredAt!: Date | null;
}
