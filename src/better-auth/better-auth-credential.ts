import { hashPassword } from 'better-auth/crypto';
import { monotonicFactory } from 'ulid';
import type { DataSource } from 'typeorm';

const nextUlid = monotonicFactory();

function prefixedUlid(prefix: string): string {
  return `${prefix}_${nextUlid().toLowerCase()}`;
}

export interface UpsertBetterAuthCredentialInput {
  userId: string;
  email: string;
  displayName: string;
  password: string;
}

// Raw SQL against Better Auth's own `user`/`account` tables (materialized by
// `pnpm better-auth:schema`), not TypeORM entities. Shared by the bootstrap
// seed and the invite-accept flow.
export async function upsertBetterAuthCredential(
  dataSource: DataSource,
  input: UpsertBetterAuthCredentialInput,
): Promise<void> {
  const betterAuthTablesExist = await hasBetterAuthCredentialTables(dataSource);

  if (!betterAuthTablesExist) {
    throw new Error(
      'Better Auth `user`/`account` tables do not exist yet. Run `pnpm better-auth:schema` first.',
    );
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  const normalizedEmail = input.email.toLowerCase();
  const existingUserRows: Array<{ id: string }> = await dataSource.query(
    'SELECT "id" FROM "user" WHERE "id" = $1 OR "email" = $2 LIMIT 1',
    [input.userId, normalizedEmail],
  );

  if (existingUserRows.length === 0) {
    await dataSource.query(
      'INSERT INTO "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [input.userId, input.displayName, normalizedEmail, false, null, now, now],
    );
  } else {
    await dataSource.query(
      'UPDATE "user" SET "name" = $2, "email" = $3, "updatedAt" = $4 WHERE "id" = $1',
      [existingUserRows[0].id, input.displayName, normalizedEmail, now],
    );

    if (existingUserRows[0].id !== input.userId) {
      throw new Error(
        `Better Auth user ${existingUserRows[0].id} already exists for ${input.email} and does not match Internal ID user ${input.userId}.`,
      );
    }
  }

  const existingCredentialRows: Array<{ id: string }> = await dataSource.query(
    'SELECT "id" FROM "account" WHERE "userId" = $1 AND "providerId" = $2 LIMIT 1',
    [input.userId, 'credential'],
  );

  if (existingCredentialRows.length === 0) {
    await dataSource.query(
      'INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        prefixedUlid('bac'),
        input.userId,
        'credential',
        input.userId,
        passwordHash,
        now,
        now,
      ],
    );
    return;
  }

  await dataSource.query(
    'UPDATE "account" SET "accountId" = $2, "password" = $3, "updatedAt" = $4 WHERE "id" = $1',
    [existingCredentialRows[0].id, input.userId, passwordHash, now],
  );
}

export async function hasBetterAuthCredentialTables(
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
