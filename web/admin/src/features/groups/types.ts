import type { UserStatus } from '../users/types';

// Shapes from docs/ADMIN_API_CONTRACT.md, mirroring GroupEntity and the
// AdminGroupService input interfaces.

export interface GroupSummary {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
}

export interface GroupMember {
  id: string;
  displayName: string;
  email: string;
  status: UserStatus;
}

export interface GroupDetail extends GroupSummary {
  updatedAt: string;
  members: GroupMember[];
}

export interface GroupListResponse {
  items: GroupSummary[];
  nextCursor: string | null;
}

export interface AdminCreateGroupInput {
  slug: string;
  displayName: string;
  description?: string | null;
}

export type AdminUpdateGroupInput = Partial<AdminCreateGroupInput>;
