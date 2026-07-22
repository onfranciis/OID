import type { BadgeTone } from '../../components/status-badge';

export type UserStatus = 'pending' | 'active' | 'suspended' | 'deactivated';
export type UserProfileType = 'employee' | 'contractor' | 'service';

export const USER_STATUSES: UserStatus[] = [
  'pending',
  'active',
  'suspended',
  'deactivated',
];

export const USER_PROFILE_TYPES: UserProfileType[] = [
  'employee',
  'contractor',
  'service',
];

export interface UserSummary {
  id: string;
  email: string;
  username: string | null;
  displayName: string;
  profileType: UserProfileType;
  status: UserStatus;
  createdAt: string;
}

export interface UserGroupRef {
  id: string;
  slug: string;
  displayName: string;
}

export interface UserDetail extends UserSummary {
  givenName: string | null;
  familyName: string | null;
  emailVerifiedAt: string | null;
  updatedAt: string;
  deactivatedAt: string | null;
  groups: UserGroupRef[];
}

export interface UserListResponse {
  items: UserSummary[];
  nextCursor: string | null;
}

export interface AdminCreateUserInput {
  email: string;
  displayName: string;
  givenName?: string | null;
  familyName?: string | null;
  username?: string | null;
  profileType?: UserProfileType;
}

export type AdminUpdateUserInput = Partial<AdminCreateUserInput>;

// Revocation counts are present when deactivation revoked live sessions/tokens.
export interface SetUserStatusResponse {
  user: UserDetail;
  revokedProviderSessionCount?: number;
  revokedRefreshTokenCount?: number;
}

export function userStatusTone(status: UserStatus): BadgeTone {
  switch (status) {
    case 'active':
      return 'success';
    case 'pending':
      return 'muted';
    case 'suspended':
      return 'warning';
    case 'deactivated':
      return 'danger';
  }
}
