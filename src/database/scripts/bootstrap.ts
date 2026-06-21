import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { hashPassword } from 'better-auth/crypto';
import { monotonicFactory } from 'ulid';
import { DataSource } from 'typeorm';
import { configuration } from '../../config/configuration';
import { createTypeOrmOptions } from '../typeorm.config';
import { GroupMembershipEntity } from '../entities/group-membership.entity';
import { GroupEntity } from '../entities/group.entity';
import {
  OidcClientEntity,
  OidcClientStatus,
  OidcClientType,
} from '../entities/oidc-client.entity';
import { OidcPostLogoutRedirectUriEntity } from '../entities/oidc-post-logout-redirect-uri.entity';
import { OidcRedirectUriEntity } from '../entities/oidc-redirect-uri.entity';
import {
  UserEntity,
  UserProfileType,
  UserStatus,
} from '../entities/user.entity';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

if (existsSync('.env.local')) {
  loadEnvFile('.env.local');
}

const nextUlid = monotonicFactory();

function prefixedUlid(prefix: string): string {
  return `${prefix}_${nextUlid().toLowerCase()}`;
}

function normalizeNullable(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

async function bootstrap(): Promise<void> {
  const appEnvironment = configuration();
  const dataSource = new DataSource(createTypeOrmOptions(appEnvironment));

  await dataSource.initialize();

  try {
    await dataSource.transaction(async (entityManager) => {
      const userRepository = entityManager.getRepository(UserEntity);
      const groupRepository = entityManager.getRepository(GroupEntity);
      const membershipRepository = entityManager.getRepository(
        GroupMembershipEntity,
      );
      const clientRepository = entityManager.getRepository(OidcClientEntity);
      const redirectUriRepository = entityManager.getRepository(
        OidcRedirectUriEntity,
      );
      const postLogoutRedirectUriRepository = entityManager.getRepository(
        OidcPostLogoutRedirectUriEntity,
      );

      const normalizedEmail = appEnvironment.bootstrap.adminEmail.toLowerCase();
      const normalizedUsername = normalizeNullable(
        appEnvironment.bootstrap.adminUsername?.toLowerCase() ?? null,
      );

      let adminUser = await userRepository.findOne({
        where: { normalizedEmail },
      });

      if (!adminUser) {
        adminUser = userRepository.create({
          id: prefixedUlid('usr'),
          email: appEnvironment.bootstrap.adminEmail,
          normalizedEmail,
          emailVerifiedAt: null,
          username: normalizeNullable(appEnvironment.bootstrap.adminUsername),
          normalizedUsername,
          displayName: appEnvironment.bootstrap.adminDisplayName,
          givenName: normalizeNullable(appEnvironment.bootstrap.adminGivenName),
          familyName: normalizeNullable(
            appEnvironment.bootstrap.adminFamilyName,
          ),
          profileType: UserProfileType.EMPLOYEE,
          status: UserStatus.ACTIVE,
          deactivatedAt: null,
        });
      } else {
        adminUser.email = appEnvironment.bootstrap.adminEmail;
        adminUser.username = normalizeNullable(
          appEnvironment.bootstrap.adminUsername,
        );
        adminUser.normalizedUsername = normalizedUsername;
        adminUser.displayName = appEnvironment.bootstrap.adminDisplayName;
        adminUser.givenName = normalizeNullable(
          appEnvironment.bootstrap.adminGivenName,
        );
        adminUser.familyName = normalizeNullable(
          appEnvironment.bootstrap.adminFamilyName,
        );
        adminUser.status = UserStatus.ACTIVE;
        adminUser.deactivatedAt = null;
      }

      adminUser = await userRepository.save(adminUser);

      let adminGroup = await groupRepository.findOne({
        where: { slug: appEnvironment.bootstrap.adminGroupSlug },
      });

      if (!adminGroup) {
        adminGroup = groupRepository.create({
          id: prefixedUlid('grp'),
          slug: appEnvironment.bootstrap.adminGroupSlug,
          displayName: appEnvironment.bootstrap.adminGroupName,
          description:
            'Bootstrap administrative group for the Internal ID control plane.',
        });
      } else {
        adminGroup.displayName = appEnvironment.bootstrap.adminGroupName;
      }

      adminGroup = await groupRepository.save(adminGroup);

      const existingMembership = await membershipRepository.findOne({
        where: {
          userId: adminUser.id,
          groupId: adminGroup.id,
        },
      });

      if (!existingMembership) {
        await membershipRepository.save(
          membershipRepository.create({
            userId: adminUser.id,
            groupId: adminGroup.id,
            createdById: adminUser.id,
          }),
        );
      }

      let oidcClient = await clientRepository.findOne({
        where: { clientId: appEnvironment.bootstrap.clientId },
      });

      if (!oidcClient) {
        oidcClient = clientRepository.create({
          id: prefixedUlid('cli'),
          clientId: appEnvironment.bootstrap.clientId,
          clientSecretHash: appEnvironment.bootstrap.clientSecret
            ? hashSecret(appEnvironment.bootstrap.clientSecret)
            : null,
          name: appEnvironment.bootstrap.clientName,
          type: OidcClientType.CONFIDENTIAL,
          status: OidcClientStatus.ACTIVE,
          allowedScopes: ['openid', 'profile', 'email', 'groups'],
          allowedClaims: [
            'sub',
            'email',
            'email_verified',
            'name',
            'given_name',
            'family_name',
            'preferred_username',
            'groups',
            'profile_type',
          ],
          requirePkce: true,
          allowRefreshTokens: false,
          accessTokenTtlSeconds: 900,
          idTokenTtlSeconds: 900,
          refreshTokenIdleTtlSeconds: null,
          refreshTokenAbsoluteTtlSeconds: null,
          ownerTeam: 'identity-platform',
        });
      } else {
        oidcClient.name = appEnvironment.bootstrap.clientName;
        oidcClient.type = OidcClientType.CONFIDENTIAL;
        oidcClient.status = OidcClientStatus.ACTIVE;
        oidcClient.requirePkce = true;
        if (appEnvironment.bootstrap.clientSecret) {
          oidcClient.clientSecretHash = hashSecret(
            appEnvironment.bootstrap.clientSecret,
          );
        }
      }

      oidcClient = await clientRepository.save(oidcClient);

      const existingRedirectUri = await redirectUriRepository.findOne({
        where: {
          clientId: oidcClient.id,
          uri: appEnvironment.bootstrap.clientRedirectUri,
        },
      });

      if (!existingRedirectUri) {
        await redirectUriRepository.save(
          redirectUriRepository.create({
            id: prefixedUlid('rdu'),
            clientId: oidcClient.id,
            uri: appEnvironment.bootstrap.clientRedirectUri,
          }),
        );
      }

      const existingPostLogoutRedirectUri =
        await postLogoutRedirectUriRepository.findOne({
          where: {
            clientId: oidcClient.id,
            uri: appEnvironment.bootstrap.clientPostLogoutRedirectUri,
          },
        });

      if (!existingPostLogoutRedirectUri) {
        await postLogoutRedirectUriRepository.save(
          postLogoutRedirectUriRepository.create({
            id: prefixedUlid('plu'),
            clientId: oidcClient.id,
            uri: appEnvironment.bootstrap.clientPostLogoutRedirectUri,
          }),
        );
      }

      console.log(
        JSON.stringify(
          {
            adminUserId: adminUser.id,
            adminGroupId: adminGroup.id,
            clientId: oidcClient.id,
            publicClientIdentifier: oidcClient.clientId,
          },
          null,
          2,
        ),
      );

      if (appEnvironment.bootstrap.adminPassword) {
        await ensureBetterAuthCredentialUser(
          entityManager.connection,
          adminUser.id,
          adminUser.email,
          adminUser.displayName,
          appEnvironment.bootstrap.adminPassword,
        );
      }
    });
  } finally {
    await dataSource.destroy();
  }
}

async function ensureBetterAuthCredentialUser(
  dataSource: DataSource,
  userId: string,
  email: string,
  displayName: string,
  password: string,
): Promise<void> {
  const betterAuthTablesExist = await hasBetterAuthCredentialTables(dataSource);

  if (!betterAuthTablesExist) {
    console.warn(
      [
        'Skipping Better Auth credential bootstrap because the Better Auth',
        '`user`/`account` tables do not exist yet.',
        'Run `pnpm better-auth:schema` first, then rerun `pnpm seed:bootstrap`',
        'if you want the bootstrap admin credential account synced.',
      ].join(' '),
    );
    return;
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const existingUserRows: Array<{ id: string }> = await dataSource.query(
    'SELECT "id" FROM "user" WHERE "id" = $1 OR "email" = $2 LIMIT 1',
    [userId, email.toLowerCase()],
  );

  if (existingUserRows.length === 0) {
    await dataSource.query(
      'INSERT INTO "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, displayName, email.toLowerCase(), false, null, now, now],
    );
  } else {
    await dataSource.query(
      'UPDATE "user" SET "name" = $2, "email" = $3, "updatedAt" = $4 WHERE "id" = $1',
      [existingUserRows[0].id, displayName, email.toLowerCase(), now],
    );

    if (existingUserRows[0].id !== userId) {
      throw new Error(
        `Better Auth user ${existingUserRows[0].id} already exists for ${email} and does not match Internal ID user ${userId}.`,
      );
    }
  }

  const existingCredentialRows: Array<{ id: string }> = await dataSource.query(
    'SELECT "id" FROM "account" WHERE "userId" = $1 AND "providerId" = $2 LIMIT 1',
    [userId, 'credential'],
  );

  if (existingCredentialRows.length === 0) {
    await dataSource.query(
      'INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        prefixedUlid('bac'),
        userId,
        'credential',
        userId,
        passwordHash,
        now,
        now,
      ],
    );
    return;
  }

  await dataSource.query(
    'UPDATE "account" SET "accountId" = $2, "password" = $3, "updatedAt" = $4 WHERE "id" = $1',
    [existingCredentialRows[0].id, userId, passwordHash, now],
  );
}

async function hasBetterAuthCredentialTables(
  dataSource: DataSource,
): Promise<boolean> {
  const rows: Array<{ table_name: string }> = await dataSource.query(
    `SELECT "table_name"
     FROM "information_schema"."tables"
     WHERE "table_schema" = 'public'
       AND "table_name" IN ('user', 'account')`,
  );

  const tableNames = new Set(rows.map((row) => row.table_name));

  return tableNames.has('user') && tableNames.has('account');
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
