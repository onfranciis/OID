import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GroupMembershipEntity } from './group-membership.entity';

@Entity({ name: 'groups' })
export class GroupEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Index('uq_groups_slug', { unique: true })
  @Column({ type: 'text' })
  slug!: string;

  @Column({ name: 'display_name', type: 'text' })
  displayName!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => GroupMembershipEntity, (membership) => membership.group)
  memberships!: GroupMembershipEntity[];
}
