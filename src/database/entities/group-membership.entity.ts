import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { GroupEntity } from './group.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'group_memberships' })
export class GroupMembershipEntity {
  @PrimaryColumn({ name: 'user_id', type: 'text' })
  userId!: string;

  @PrimaryColumn({ name: 'group_id', type: 'text' })
  groupId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'created_by', type: 'text', nullable: true })
  createdById!: string | null;

  @ManyToOne(() => UserEntity, (user) => user.groupMemberships, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @ManyToOne(() => GroupEntity, (group) => group.memberships, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'group_id' })
  group!: GroupEntity;

  @ManyToOne(() => UserEntity, (user) => user.createdMemberships, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'created_by' })
  createdBy!: UserEntity | null;
}
