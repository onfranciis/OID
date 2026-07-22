import { http, HttpResponse } from 'msw';
import type { SessionInfo } from '../app/session';
import type {
  AdminCreateClientInput,
  AdminUpdateClientInput,
  ClientDetail,
  ClientSummary,
  OidcClientStatus,
  OidcClientType,
} from '../features/clients/types';
import type { AuditEvent, AuditSeverity } from '../features/audit/types';
import type { GroupDetail, GroupSummary } from '../features/groups/types';
import type {
  AdminCreateUserInput,
  AdminUpdateUserInput,
  UserDetail,
  UserProfileType,
  UserStatus,
  UserSummary,
} from '../features/users/types';

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

export const MOCK_LOGIN_PASSWORD = 'correct-horse-battery';

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

interface MockClient {
  id: string;
  clientId: string;
  clientSecretHash: string | null;
  name: string;
  type: OidcClientType;
  status: OidcClientStatus;
  allowedScopes: string[];
  allowedClaims: string[];
  requirePkce: boolean;
  allowRefreshTokens: boolean;
  accessTokenTtlSeconds: number;
  idTokenTtlSeconds: number;
  refreshTokenIdleTtlSeconds: number | null;
  refreshTokenAbsoluteTtlSeconds: number | null;
  ownerTeam: string | null;
  createdAt: string;
  updatedAt: string;
  redirectUris: Array<{ id: string; uri: string }>;
}

interface MockInvite {
  token: string;
  userId: string;
  consumed: boolean;
}

interface MockDb {
  users: MockUser[];
  groups: MockGroup[];
  clients: MockClient[];
  auditEvents: AuditEvent[];
  invites: MockInvite[];
  counter: number;
}

interface AuditSeed {
  eventType: string;
  severity: AuditSeverity;
  actorUserId: string | null;
  targetUserId: string | null;
  clientId: string | null;
  metadata: Record<string, unknown>;
}

const AUDIT_SEEDS: AuditSeed[] = [
  {
    eventType: 'admin.user.created',
    severity: 'info',
    actorUserId: 'usr_01mockadmin0000000000000000',
    targetUserId: 'usr_seed000000000000000000000001',
    clientId: null,
    metadata: {
      normalizedEmail: 'alice.adeyemi@company.com',
      status: 'pending',
    },
  },
  {
    eventType: 'admin.user.status_changed',
    severity: 'info',
    actorUserId: 'usr_01mockadmin0000000000000000',
    targetUserId: 'usr_seed000000000000000000000001',
    clientId: null,
    metadata: { status: 'active' },
  },
  {
    eventType: 'admin.client.secret_rotated',
    severity: 'warning',
    actorUserId: 'usr_01mockadmin0000000000000000',
    targetUserId: null,
    clientId: 'cli_sample000000000000000000000',
    metadata: { clientId: 'internal-id-sample-client' },
  },
  {
    eventType: 'admin.group.membership_added',
    severity: 'info',
    actorUserId: 'usr_01mockadmin0000000000000000',
    targetUserId: 'usr_seed000000000000000000000002',
    clientId: null,
    metadata: { groupId: 'grp_engineering0000000000000' },
  },
  {
    eventType: 'user.login.rejected',
    severity: 'warning',
    actorUserId: null,
    targetUserId: 'usr_seed000000000000000000000004',
    clientId: null,
    metadata: { reason: 'invalid_credentials' },
  },
  {
    eventType: 'oidc.token.issued',
    severity: 'info',
    actorUserId: 'usr_seed000000000000000000000001',
    targetUserId: null,
    clientId: 'cli_sample000000000000000000000',
    metadata: { grantType: 'authorization_code' },
  },
  {
    eventType: 'oidc.refresh_token.replayed',
    severity: 'critical',
    actorUserId: null,
    targetUserId: 'usr_seed000000000000000000000005',
    clientId: 'cli_sample000000000000000000000',
    metadata: { action: 'family_revoked', revokedCount: 3 },
  },
];

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

  const clients: MockClient[] = [
    {
      id: 'cli_sample000000000000000000000',
      clientId: 'internal-id-sample-client',
      clientSecretHash: 'seeded-hash',
      name: 'Internal ID Sample Client',
      type: 'confidential',
      status: 'active',
      allowedScopes: ['openid', 'profile', 'email'],
      allowedClaims: ['sub', 'email', 'name'],
      requirePkce: true,
      allowRefreshTokens: true,
      accessTokenTtlSeconds: 900,
      idTokenTtlSeconds: 900,
      refreshTokenIdleTtlSeconds: 60 * 60 * 24 * 7,
      refreshTokenAbsoluteTtlSeconds: 60 * 60 * 24 * 30,
      ownerTeam: 'Platform',
      createdAt: isoDaysAgo(120),
      updatedAt: isoDaysAgo(5),
      redirectUris: [
        {
          id: 'rdu_sample0000000000000000000',
          uri: 'http://localhost:4000/auth/callback',
        },
      ],
    },
    {
      id: 'cli_spa00000000000000000000000',
      clientId: 'internal-dashboard-spa',
      clientSecretHash: null,
      name: 'Internal Dashboard (SPA)',
      type: 'public',
      status: 'active',
      allowedScopes: ['openid', 'profile'],
      allowedClaims: ['sub'],
      requirePkce: true,
      allowRefreshTokens: false,
      accessTokenTtlSeconds: 600,
      idTokenTtlSeconds: 600,
      refreshTokenIdleTtlSeconds: null,
      refreshTokenAbsoluteTtlSeconds: null,
      ownerTeam: 'Data',
      createdAt: isoDaysAgo(60),
      updatedAt: isoDaysAgo(2),
      redirectUris: [
        {
          id: 'rdu_spa000000000000000000000',
          uri: 'https://dashboard.company.com/callback',
        },
      ],
    },
    {
      id: 'cli_legacy000000000000000000000',
      clientId: 'legacy-intranet',
      clientSecretHash: 'seeded-hash',
      name: 'Legacy Intranet',
      type: 'confidential',
      status: 'disabled',
      allowedScopes: ['openid'],
      allowedClaims: ['sub'],
      requirePkce: false,
      allowRefreshTokens: false,
      accessTokenTtlSeconds: 900,
      idTokenTtlSeconds: 900,
      refreshTokenIdleTtlSeconds: null,
      refreshTokenAbsoluteTtlSeconds: null,
      ownerTeam: null,
      createdAt: isoDaysAgo(500),
      updatedAt: isoDaysAgo(200),
      redirectUris: [],
    },
  ];

  // Repeat the seed set a few times for volume; newest first.
  const auditEvents: AuditEvent[] = Array.from({ length: 4 }).flatMap(
    (_unused, round) =>
      AUDIT_SEEDS.map((seed, index) => {
        const sequence = round * AUDIT_SEEDS.length + index;

        return {
          id: `aud_seed${String(sequence + 1).padStart(24, '0')}`,
          eventType: seed.eventType,
          severity: seed.severity,
          actorUserId: seed.actorUserId,
          targetUserId: seed.targetUserId,
          clientId: seed.clientId,
          providerSessionId: seed.actorUserId
            ? 'ses_mock000000000000000000000'
            : null,
          ipAddress: '198.51.100.24',
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          metadata: seed.metadata,
          createdAt: new Date(Date.now() - sequence * 3_600_000).toISOString(),
        } satisfies AuditEvent;
      }),
  );

  return { users, groups, clients, auditEvents, invites: [], counter: 0 };
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

function toGroupSummary(group: MockGroup): GroupSummary {
  return {
    id: group.id,
    slug: group.slug,
    displayName: group.displayName,
    description: group.description,
    createdAt: group.createdAt,
    memberCount: db.users.filter((user) => user.groupIds.includes(group.id))
      .length,
  };
}

function toGroupDetail(group: MockGroup): GroupDetail {
  return {
    ...toGroupSummary(group),
    // Groups are rarely mutated in the mock; reuse createdAt for updatedAt.
    updatedAt: group.createdAt,
    members: db.users
      .filter((user) => user.groupIds.includes(group.id))
      .map((user) => ({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        status: user.status,
      })),
  };
}

function toClientSummary(client: MockClient): ClientSummary {
  return {
    id: client.id,
    clientId: client.clientId,
    name: client.name,
    type: client.type,
    status: client.status,
    ownerTeam: client.ownerTeam,
    hasSecret: client.clientSecretHash !== null,
    createdAt: client.createdAt,
  };
}

function toClientDetail(client: MockClient): ClientDetail {
  return {
    ...toClientSummary(client),
    allowedScopes: client.allowedScopes,
    allowedClaims: client.allowedClaims,
    requirePkce: client.requirePkce,
    allowRefreshTokens: client.allowRefreshTokens,
    accessTokenTtlSeconds: client.accessTokenTtlSeconds,
    idTokenTtlSeconds: client.idTokenTtlSeconds,
    refreshTokenIdleTtlSeconds: client.refreshTokenIdleTtlSeconds,
    refreshTokenAbsoluteTtlSeconds: client.refreshTokenAbsoluteTtlSeconds,
    updatedAt: client.updatedAt,
    redirectUris: client.redirectUris,
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

  http.post('/logout', () => new HttpResponse(null, { status: 204 })),

  http.get('/admin/api/auth/login', () =>
    HttpResponse.json({ csrfToken: 'login-nonce.login-signature' }),
  ),
  http.post('/admin/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      returnTo?: string;
    };

    if (
      body.email?.toLowerCase() === mockSession.user.email &&
      body.password === MOCK_LOGIN_PASSWORD
    ) {
      return HttpResponse.json({ redirectTo: body.returnTo || '/admin' });
    }

    return errorResponse(
      401,
      'We could not sign you in with those credentials.',
      'Unauthorized',
    );
  }),

  http.post('/admin/api/account/change-password', async ({ request }) => {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (body.currentPassword !== MOCK_LOGIN_PASSWORD) {
      return errorResponse(400, 'Invalid password', 'Bad Request');
    }

    if (!body.newPassword || body.newPassword.length < 8) {
      return errorResponse(400, 'Password is too short.', 'Bad Request');
    }

    return HttpResponse.json({ success: true });
  }),

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

  http.post('/admin/api/users/:userId/invite', ({ params, request }) => {
    const csrfError = requireCsrf(request);

    if (csrfError) {
      return csrfError;
    }

    const user = db.users.find((candidate) => candidate.id === params.userId);

    if (!user) {
      return errorResponse(404, 'User not found.', 'Not Found');
    }

    db.invites = db.invites.filter((invite) => invite.userId !== user.id);
    db.invites.push({
      token: `mock-invite-token-${user.id}`,
      userId: user.id,
      consumed: false,
    });

    return HttpResponse.json({ success: true });
  }),

  http.get('/admin/api/invites/:token', ({ params }) => {
    const invite = db.invites.find(
      (candidate) => candidate.token === params.token && !candidate.consumed,
    );
    const user = invite
      ? db.users.find((candidate) => candidate.id === invite.userId)
      : null;

    if (!invite || !user) {
      return errorResponse(
        404,
        'This invite link is invalid or has expired.',
        'Not Found',
      );
    }

    return HttpResponse.json({
      email: user.email,
      displayName: user.displayName,
    });
  }),

  http.post('/admin/api/invites/:token/accept', async ({ params, request }) => {
    const invite = db.invites.find(
      (candidate) => candidate.token === params.token && !candidate.consumed,
    );
    const user = invite
      ? db.users.find((candidate) => candidate.id === invite.userId)
      : null;

    if (!invite || !user) {
      return errorResponse(
        404,
        'This invite link is invalid or has expired.',
        'Not Found',
      );
    }

    const { password } = (await request.json()) as { password?: string };

    if (!password || password.length < 8) {
      return errorResponse(
        400,
        'Password must be at least 8 characters.',
        'Bad Request',
      );
    }

    invite.consumed = true;

    if (user.status === 'pending') {
      user.status = 'active';
      user.updatedAt = new Date().toISOString();
    }

    return HttpResponse.json({ success: true });
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

  http.get('/admin/api/groups', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase() ?? '';

    const matches = q
      ? db.groups.filter((group) =>
          [group.slug, group.displayName].some((value) =>
            value.toLowerCase().includes(q),
          ),
        )
      : db.groups;

    return HttpResponse.json({
      items: matches.map(toGroupSummary),
      nextCursor: null,
    });
  }),

  http.get('/admin/api/groups/:groupId', ({ params }) => {
    const group = db.groups.find(
      (candidate) => candidate.id === params.groupId,
    );

    if (!group) {
      return errorResponse(404, 'Group not found.', 'Not Found');
    }

    return HttpResponse.json(toGroupDetail(group));
  }),

  http.post('/admin/api/groups', async ({ request }) => {
    const csrfError = requireCsrf(request);

    if (csrfError) {
      return csrfError;
    }

    const input = (await request.json()) as {
      slug?: string;
      displayName?: string;
      description?: string | null;
    };
    const slug = input.slug?.trim().toLowerCase();

    if (!slug || !input.displayName?.trim()) {
      return errorResponse(400, 'slug is required.', 'Bad Request');
    }

    if (db.groups.some((group) => group.slug === slug)) {
      return errorResponse(409, 'Group slug is already in use.', 'Conflict');
    }

    db.counter += 1;
    const group: MockGroup = {
      id: `grp_new${String(db.counter).padStart(25, '0')}`,
      slug,
      displayName: input.displayName.trim(),
      description: input.description?.trim() || null,
      createdAt: new Date().toISOString(),
    };
    db.groups.push(group);

    return HttpResponse.json(toGroupDetail(group));
  }),

  http.post('/admin/api/groups/:groupId', async ({ params, request }) => {
    const csrfError = requireCsrf(request);

    if (csrfError) {
      return csrfError;
    }

    const group = db.groups.find(
      (candidate) => candidate.id === params.groupId,
    );

    if (!group) {
      return errorResponse(404, 'Group not found.', 'Not Found');
    }

    const input = (await request.json()) as {
      slug?: string;
      displayName?: string;
      description?: string | null;
    };

    if (input.slug !== undefined) {
      const slug = input.slug.trim().toLowerCase();

      if (
        slug !== group.slug &&
        db.groups.some((candidate) => candidate.slug === slug)
      ) {
        return errorResponse(409, 'Group slug is already in use.', 'Conflict');
      }

      group.slug = slug;
    }

    if (input.displayName !== undefined) {
      group.displayName = input.displayName.trim();
    }

    if (input.description !== undefined) {
      group.description = input.description?.trim() || null;
    }

    return HttpResponse.json(toGroupDetail(group));
  }),

  http.post('/admin/api/groups/:groupId/delete', ({ params, request }) => {
    const csrfError = requireCsrf(request);

    if (csrfError) {
      return csrfError;
    }

    const group = db.groups.find(
      (candidate) => candidate.id === params.groupId,
    );

    if (!group) {
      return errorResponse(404, 'Group not found.', 'Not Found');
    }

    const memberCount = db.users.filter((user) =>
      user.groupIds.includes(group.id),
    ).length;

    if (memberCount > 0) {
      return errorResponse(
        409,
        'Remove all members before deleting the group.',
        'Conflict',
      );
    }

    db.groups = db.groups.filter((candidate) => candidate.id !== group.id);

    return HttpResponse.json({ id: group.id });
  }),

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

  http.get('/admin/api/clients', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase() ?? '';
    const status = url.searchParams.get('status') ?? '';
    const cursor = url.searchParams.get('cursor');
    const limit = Number(url.searchParams.get('limit') ?? DEFAULT_PAGE_SIZE);

    let matches = db.clients;

    if (q) {
      matches = matches.filter((client) =>
        [client.clientId, client.name, client.ownerTeam ?? ''].some((value) =>
          value.toLowerCase().includes(q),
        ),
      );
    }

    if (status) {
      matches = matches.filter((client) => client.status === status);
    }

    const startIndex = cursor
      ? matches.findIndex((client) => client.id === cursor) + 1
      : 0;
    const page = matches.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < matches.length
        ? (page[page.length - 1]?.id ?? null)
        : null;

    return HttpResponse.json({
      items: page.map(toClientSummary),
      nextCursor,
    });
  }),

  http.get('/admin/api/clients/:recordId', ({ params }) => {
    const client = db.clients.find(
      (candidate) => candidate.id === params.recordId,
    );

    if (!client) {
      return errorResponse(404, 'Client not found.', 'Not Found');
    }

    return HttpResponse.json(toClientDetail(client));
  }),

  http.post('/admin/api/clients', async ({ request }) => {
    const csrfError = requireCsrf(request);

    if (csrfError) {
      return csrfError;
    }

    const input = (await request.json()) as AdminCreateClientInput;
    const clientId = input.clientId?.trim();

    if (!clientId || !input.name?.trim()) {
      return errorResponse(400, 'clientId is required.', 'Bad Request');
    }

    if (db.clients.some((client) => client.clientId === clientId)) {
      return errorResponse(409, 'Client ID is already in use.', 'Conflict');
    }

    db.counter += 1;
    const now = new Date().toISOString();
    const client: MockClient = {
      id: `cli_new${String(db.counter).padStart(25, '0')}`,
      clientId,
      clientSecretHash: null,
      name: input.name.trim(),
      type: input.type ?? 'confidential',
      status: 'active',
      allowedScopes: input.allowedScopes ?? ['openid'],
      allowedClaims: input.allowedClaims ?? ['sub'],
      requirePkce: input.requirePkce ?? true,
      allowRefreshTokens: input.allowRefreshTokens ?? false,
      accessTokenTtlSeconds: input.accessTokenTtlSeconds ?? 900,
      idTokenTtlSeconds: input.idTokenTtlSeconds ?? 900,
      refreshTokenIdleTtlSeconds: input.allowRefreshTokens
        ? (input.refreshTokenIdleTtlSeconds ?? 60 * 60 * 24 * 7)
        : null,
      refreshTokenAbsoluteTtlSeconds: input.allowRefreshTokens
        ? (input.refreshTokenAbsoluteTtlSeconds ?? 60 * 60 * 24 * 30)
        : null,
      ownerTeam: input.ownerTeam ?? null,
      createdAt: now,
      updatedAt: now,
      redirectUris: [],
    };
    db.clients.unshift(client);

    return HttpResponse.json(toClientDetail(client));
  }),

  http.post(
    '/admin/api/clients/:recordId/status',
    async ({ params, request }) => {
      const csrfError = requireCsrf(request);

      if (csrfError) {
        return csrfError;
      }

      const client = db.clients.find(
        (candidate) => candidate.id === params.recordId,
      );

      if (!client) {
        return errorResponse(404, 'Client not found.', 'Not Found');
      }

      const { status } = (await request.json()) as { status: OidcClientStatus };
      client.status = status;
      client.updatedAt = new Date().toISOString();

      return HttpResponse.json(toClientDetail(client));
    },
  ),

  http.post(
    '/admin/api/clients/:recordId/secret/rotate',
    ({ params, request }) => {
      const csrfError = requireCsrf(request);

      if (csrfError) {
        return csrfError;
      }

      const client = db.clients.find(
        (candidate) => candidate.id === params.recordId,
      );

      if (!client) {
        return errorResponse(404, 'Client not found.', 'Not Found');
      }

      if (client.type !== 'confidential') {
        return errorResponse(
          400,
          'Only confidential clients can have client secrets.',
          'Bad Request',
        );
      }

      db.counter += 1;
      const clientSecret = `oidc_secret_mock_${db.counter}_${Math.random()
        .toString(36)
        .slice(2)}`;
      client.clientSecretHash = 'rotated-hash';
      client.updatedAt = new Date().toISOString();

      return HttpResponse.json({ clientId: client.clientId, clientSecret });
    },
  ),

  http.post(
    '/admin/api/clients/:recordId/redirect-uris',
    async ({ params, request }) => {
      const csrfError = requireCsrf(request);

      if (csrfError) {
        return csrfError;
      }

      const client = db.clients.find(
        (candidate) => candidate.id === params.recordId,
      );

      if (!client) {
        return errorResponse(404, 'Client not found.', 'Not Found');
      }

      const { uri } = (await request.json()) as { uri: string };
      const normalized = uri.trim();

      if (client.redirectUris.some((entry) => entry.uri === normalized)) {
        return errorResponse(
          409,
          'Redirect URI is already registered.',
          'Conflict',
        );
      }

      db.counter += 1;
      const redirectUri = {
        id: `rdu_new${String(db.counter).padStart(24, '0')}`,
        uri: normalized,
      };
      client.redirectUris.push(redirectUri);
      client.updatedAt = new Date().toISOString();

      return HttpResponse.json(redirectUri);
    },
  ),

  http.post(
    '/admin/api/clients/:recordId/redirect-uris/:redirectUriId/remove',
    ({ params, request }) => {
      const csrfError = requireCsrf(request);

      if (csrfError) {
        return csrfError;
      }

      const client = db.clients.find(
        (candidate) => candidate.id === params.recordId,
      );
      const redirectUri = client?.redirectUris.find(
        (entry) => entry.id === params.redirectUriId,
      );

      if (!client || !redirectUri) {
        return errorResponse(404, 'Redirect URI not found.', 'Not Found');
      }

      client.redirectUris = client.redirectUris.filter(
        (entry) => entry.id !== redirectUri.id,
      );
      client.updatedAt = new Date().toISOString();

      return HttpResponse.json({ id: redirectUri.id });
    },
  ),

  http.post('/admin/api/clients/:recordId', async ({ params, request }) => {
    const csrfError = requireCsrf(request);

    if (csrfError) {
      return csrfError;
    }

    const client = db.clients.find(
      (candidate) => candidate.id === params.recordId,
    );

    if (!client) {
      return errorResponse(404, 'Client not found.', 'Not Found');
    }

    const input = (await request.json()) as AdminUpdateClientInput;

    if (input.name !== undefined) {
      client.name = input.name.trim();
    }
    if (input.ownerTeam !== undefined) {
      client.ownerTeam = input.ownerTeam;
    }
    if (input.allowedScopes !== undefined) {
      client.allowedScopes = input.allowedScopes;
    }
    if (input.allowedClaims !== undefined) {
      client.allowedClaims = input.allowedClaims;
    }
    if (input.requirePkce !== undefined) {
      client.requirePkce = input.requirePkce;
    }
    if (input.allowRefreshTokens !== undefined) {
      client.allowRefreshTokens = input.allowRefreshTokens;
    }
    if (input.accessTokenTtlSeconds !== undefined) {
      client.accessTokenTtlSeconds = input.accessTokenTtlSeconds;
    }
    if (input.idTokenTtlSeconds !== undefined) {
      client.idTokenTtlSeconds = input.idTokenTtlSeconds;
    }
    if (input.refreshTokenIdleTtlSeconds !== undefined) {
      client.refreshTokenIdleTtlSeconds = client.allowRefreshTokens
        ? input.refreshTokenIdleTtlSeconds
        : null;
    }
    if (input.refreshTokenAbsoluteTtlSeconds !== undefined) {
      client.refreshTokenAbsoluteTtlSeconds = client.allowRefreshTokens
        ? input.refreshTokenAbsoluteTtlSeconds
        : null;
    }

    client.updatedAt = new Date().toISOString();

    return HttpResponse.json(toClientDetail(client));
  }),

  http.get('/admin/api/audit-events', ({ request }) => {
    const url = new URL(request.url);
    const eventType = url.searchParams.get('eventType');
    const severity = url.searchParams.get('severity');
    const actorUserId = url.searchParams.get('actorUserId');
    const targetUserId = url.searchParams.get('targetUserId');
    const clientId = url.searchParams.get('clientId');
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);

    let matches = db.auditEvents;

    if (eventType) {
      matches = matches.filter((event) => event.eventType.includes(eventType));
    }
    if (severity) {
      matches = matches.filter((event) => event.severity === severity);
    }
    if (actorUserId) {
      matches = matches.filter((event) => event.actorUserId === actorUserId);
    }
    if (targetUserId) {
      matches = matches.filter((event) => event.targetUserId === targetUserId);
    }
    if (clientId) {
      matches = matches.filter((event) => event.clientId === clientId);
    }

    const startIndex = cursor
      ? matches.findIndex((event) => event.id === cursor) + 1
      : 0;
    const page = matches.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < matches.length
        ? (page[page.length - 1]?.id ?? null)
        : null;

    return HttpResponse.json({ items: page, nextCursor });
  }),
];
