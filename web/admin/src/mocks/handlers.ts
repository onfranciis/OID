import { http, HttpResponse } from 'msw';
import type { SessionInfo } from '../app/session';
import type {
  AdminCreateUserInput,
  AdminUpdateUserInput,
  UserDetail,
  UserProfileType,
  UserStatus,
  UserSummary,
} from '../features/users/types';

// Executable specification of the assumed /admin/api/* contract
// (docs/ADMIN_API_CONTRACT.md). The backend B-07 work must satisfy the same
// shapes. State is an in-memory database, reset between tests.

export const mockSession: SessionInfo = {
  user: {
    id: 'usr_01mockadmin0000000000000000',
    displayName: 'Internal ID Administrator',
    email: 'admin@company.com',
  },
  isAdmin: true,
  csrfToken: 'mock-nonce.mock-signature',
  adminGroupSlug: 'internal-id-admins',
};

interface MockUser {
  id: string;
  email: string;
  username: string | null;
  displayName: string;
  givenName: string | null;
  familyName: string | null;
  profileType: UserProfileType;
  status: UserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
  groupIds: string[];
}

interface MockGroup {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  createdAt: string;
}

interface MockDb {
  users: MockUser[];
  groups: MockGroup[];
  counter: number;
}

const FIRST_NAMES = [
  'Alice',
  'Bola',
  'Chidi',
  'Dami',
  'Efe',
  'Funke',
  'Gozie',
  'Halima',
  'Ify',
  'Jide',
  'Kemi',
  'Lanre',
  'Musa',
  'Ngozi',
  'Ola',
  'Peju',
  'Quadri',
  'Ronke',
  'Sade',
  'Tunde',
  'Uche',
  'Vera',
  'Wale',
  'Xena',
  'Yemi',
  'Zara',
  'Ada',
  'Bisi',
];

const LAST_NAMES = ['Adeyemi', 'Okafor', 'Balogun', 'Eze', 'Ibrahim', 'Okoro'];
const STATUS_CYCLE: UserStatus[] = ['active', 'pending', 'active', 'suspended'];
const PROFILE_CYCLE: UserProfileType[] = [
  'employee',
  'employee',
  'contractor',
  'service',
];

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function createMockDb(): MockDb {
  const groups: MockGroup[] = [
    {
      id: 'grp_admins00000000000000000000',
      slug: 'internal-id-admins',
      displayName: 'Internal ID Administrators',
      description: 'Bootstrap admin group for this console.',
      createdAt: isoDaysAgo(400),
    },
    {
      id: 'grp_engineering0000000000000',
      slug: 'engineering',
      displayName: 'Engineering',
      description: 'All engineers.',
      createdAt: isoDaysAgo(300),
    },
    {
      id: 'grp_peopleops000000000000000',
      slug: 'people-ops',
      displayName: 'People Operations',
      description: null,
      createdAt: isoDaysAgo(200),
    },
  ];

  const adminUser: MockUser = {
    id: mockSession.user.id,
    email: mockSession.user.email,
    username: 'internal.admin',
    displayName: mockSession.user.displayName,
    givenName: 'Internal',
    familyName: 'Administrator',
    profileType: 'employee',
    status: 'active',
    emailVerifiedAt: isoDaysAgo(400),
    createdAt: isoDaysAgo(400),
    updatedAt: isoDaysAgo(1),
    deactivatedAt: null,
    groupIds: ['grp_admins00000000000000000000'],
  };

  const users: MockUser[] = [
    adminUser,
    ...FIRST_NAMES.map((firstName, index) => {
      const lastName = LAST_NAMES[index % LAST_NAMES.length];
      const status = STATUS_CYCLE[index % STATUS_CYCLE.length];

      return {
        id: `usr_seed${String(index + 1).padStart(24, '0')}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`,
        username:
          index % 3 === 0
            ? null
            : `${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
        displayName: `${firstName} ${lastName}`,
        givenName: firstName,
        familyName: lastName,
        profileType: PROFILE_CYCLE[index % PROFILE_CYCLE.length],
        status,
        emailVerifiedAt: status === 'pending' ? null : isoDaysAgo(index + 2),
        createdAt: isoDaysAgo(index + 1),
        updatedAt: isoDaysAgo(index + 1),
        deactivatedAt: null,
        groupIds: index % 4 === 1 ? ['grp_engineering0000000000000'] : [],
      } satisfies MockUser;
    }),
  ];

  return { users, groups, counter: 0 };
}

let db = createMockDb();

export function resetMockDb(): void {
  db = createMockDb();
}

const DEFAULT_PAGE_SIZE = 20;

function toUserSummary(user: MockUser): UserSummary {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    profileType: user.profileType,
    status: user.status,
    createdAt: user.createdAt,
  };
}

function toUserDetail(user: MockUser): UserDetail {
  return {
    ...toUserSummary(user),
    givenName: user.givenName,
    familyName: user.familyName,
    emailVerifiedAt: user.emailVerifiedAt,
    updatedAt: user.updatedAt,
    deactivatedAt: user.deactivatedAt,
    groups: user.groupIds.flatMap((groupId) => {
      const group = db.groups.find((candidate) => candidate.id === groupId);

      return group
        ? [{ id: group.id, slug: group.slug, displayName: group.displayName }]
        : [];
    }),
  };
}

function errorResponse(statusCode: number, message: string, error: string) {
  return HttpResponse.json(
    { statusCode, message, error },
    { status: statusCode },
  );
}

function requireCsrf(request: Request): Response | null {
  if (request.headers.get('x-csrf-token') !== mockSession.csrfToken) {
    return errorResponse(403, 'Invalid CSRF token.', 'Forbidden');
  }

  return null;
}

function conflictOnIdentity(
  email: string | undefined,
  username: string | null | undefined,
  excludeUserId?: string,
): Response | null {
  if (email !== undefined) {
    const normalizedEmail = email.trim().toLowerCase();
    const emailTaken = db.users.some(
      (user) =>
        user.id !== excludeUserId &&
        user.email.toLowerCase() === normalizedEmail,
    );

    if (emailTaken) {
      return errorResponse(409, 'Email is already in use.', 'Conflict');
    }
  }

  if (username !== undefined && username !== null && username.length > 0) {
    const normalizedUsername = username.trim().toLowerCase();
    const usernameTaken = db.users.some(
      (user) =>
        user.id !== excludeUserId &&
        user.username?.toLowerCase() === normalizedUsername,
    );

    if (usernameTaken) {
      return errorResponse(409, 'Username is already in use.', 'Conflict');
    }
  }

  return null;
}

export const handlers = [
  http.get('/admin/api/session', () => HttpResponse.json(mockSession)),

  http.get('/admin/api/users', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase() ?? '';
    const status = url.searchParams.get('status') ?? '';
    const cursor = url.searchParams.get('cursor');
    const limit = Number(url.searchParams.get('limit') ?? DEFAULT_PAGE_SIZE);

    let matches = db.users;

    if (q) {
      matches = matches.filter((user) =>
        [user.email, user.username ?? '', user.displayName].some((value) =>
          value.toLowerCase().includes(q),
        ),
      );
    }

    if (status) {
      matches = matches.filter((user) => user.status === status);
    }

    const startIndex = cursor
      ? matches.findIndex((user) => user.id === cursor) + 1
      : 0;
    const page = matches.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < matches.length
        ? (page[page.length - 1]?.id ?? null)
        : null;

    return HttpResponse.json({
      items: page.map(toUserSummary),
      nextCursor,
    });
  }),

  http.get('/admin/api/users/:userId', ({ params }) => {
    const user = db.users.find((candidate) => candidate.id === params.userId);

    if (!user) {
      return errorResponse(404, 'User not found.', 'Not Found');
    }

    return HttpResponse.json(toUserDetail(user));
  }),

  http.post('/admin/api/users', async ({ request }) => {
    const csrfError = requireCsrf(request);

    if (csrfError) {
      return csrfError;
    }

    const input = (await request.json()) as AdminCreateUserInput;

    if (!input.email?.trim() || !input.displayName?.trim()) {
      return errorResponse(400, 'email is required.', 'Bad Request');
    }

    const conflict = conflictOnIdentity(input.email, input.username);

    if (conflict) {
      return conflict;
    }

    db.counter += 1;
    const now = new Date().toISOString();
    const user: MockUser = {
      id: `usr_new${String(db.counter).padStart(25, '0')}`,
      email: input.email.trim(),
      username: input.username?.trim() || null,
      displayName: input.displayName.trim(),
      givenName: input.givenName?.trim() || null,
      familyName: input.familyName?.trim() || null,
      profileType: input.profileType ?? 'employee',
      status: 'pending',
      emailVerifiedAt: null,
      createdAt: now,
      updatedAt: now,
      deactivatedAt: null,
      groupIds: [],
    };
    db.users.unshift(user);

    return HttpResponse.json(toUserDetail(user));
  }),

  http.post('/admin/api/users/:userId/status', async ({ params, request }) => {
    const csrfError = requireCsrf(request);

    if (csrfError) {
      return csrfError;
    }

    const user = db.users.find((candidate) => candidate.id === params.userId);

    if (!user) {
      return errorResponse(404, 'User not found.', 'Not Found');
    }

    const { status } = (await request.json()) as { status: UserStatus };
    const deactivating = status === 'deactivated';

    user.status = status;
    user.updatedAt = new Date().toISOString();
    user.deactivatedAt = deactivating ? user.updatedAt : null;

    return HttpResponse.json({
      user: toUserDetail(user),
      ...(deactivating
        ? { revokedProviderSessionCount: 2, revokedRefreshTokenCount: 1 }
        : {}),
    });
  }),

  http.post('/admin/api/users/:userId', async ({ params, request }) => {
    const csrfError = requireCsrf(request);

    if (csrfError) {
      return csrfError;
    }

    const user = db.users.find((candidate) => candidate.id === params.userId);

    if (!user) {
      return errorResponse(404, 'User not found.', 'Not Found');
    }

    const input = (await request.json()) as AdminUpdateUserInput;
    const conflict = conflictOnIdentity(
      input.email ?? undefined,
      input.username,
      user.id,
    );

    if (conflict) {
      return conflict;
    }

    if (input.email !== undefined && input.email !== null) {
      user.email = input.email.trim();
    }

    if (input.displayName !== undefined && input.displayName !== null) {
      user.displayName = input.displayName.trim();
    }

    if (input.username !== undefined) {
      user.username = input.username?.trim() || null;
    }

    if (input.givenName !== undefined) {
      user.givenName = input.givenName?.trim() || null;
    }

    if (input.familyName !== undefined) {
      user.familyName = input.familyName?.trim() || null;
    }

    if (input.profileType !== undefined) {
      user.profileType = input.profileType;
    }

    user.updatedAt = new Date().toISOString();

    return HttpResponse.json(toUserDetail(user));
  }),

  http.get('/admin/api/groups', () =>
    HttpResponse.json({
      items: db.groups.map((group) => ({
        ...group,
        memberCount: db.users.filter((user) => user.groupIds.includes(group.id))
          .length,
      })),
      nextCursor: null,
    }),
  ),

  http.post(
    '/admin/api/groups/:groupId/members/:userId',
    ({ params, request }) => {
      const csrfError = requireCsrf(request);

      if (csrfError) {
        return csrfError;
      }

      const user = db.users.find((candidate) => candidate.id === params.userId);
      const group = db.groups.find(
        (candidate) => candidate.id === params.groupId,
      );

      if (!user || !group) {
        return errorResponse(404, 'User not found.', 'Not Found');
      }

      if (!user.groupIds.includes(group.id)) {
        user.groupIds.push(group.id);
      }

      return HttpResponse.json({ userId: user.id, groupId: group.id });
    },
  ),

  http.post(
    '/admin/api/groups/:groupId/members/:userId/remove',
    ({ params, request }) => {
      const csrfError = requireCsrf(request);

      if (csrfError) {
        return csrfError;
      }

      const user = db.users.find((candidate) => candidate.id === params.userId);
      const group = db.groups.find(
        (candidate) => candidate.id === params.groupId,
      );

      if (!user || !group || !user.groupIds.includes(group.id)) {
        return errorResponse(404, 'Group membership not found.', 'Not Found');
      }

      user.groupIds = user.groupIds.filter((groupId) => groupId !== group.id);

      return HttpResponse.json({ userId: user.id, groupId: group.id });
    },
  ),
];
