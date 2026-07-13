// Shapes from docs/ADMIN_API_CONTRACT.md. The full Groups feature ships in
// F4; these types already back the group picker on the user detail screen.

export interface GroupSummary {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
}

export interface GroupListResponse {
  items: GroupSummary[];
  nextCursor: string | null;
}
