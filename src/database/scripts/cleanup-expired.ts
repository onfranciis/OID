import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { DataSource } from 'typeorm';
import { configuration } from '../../config/configuration';
import { createTypeOrmOptions } from '../typeorm.config';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

if (existsSync('.env.local')) {
  loadEnvFile('.env.local');
}

async function cleanupExpiredState(): Promise<void> {
  const dataSource = new DataSource(createTypeOrmOptions(configuration()));
  await dataSource.initialize();

  try {
    const expiredAuthorizationCodes = await runBatched(
      dataSource,
      `
        DELETE FROM "authorization_codes"
        WHERE "ctid" IN (
          SELECT "ctid" FROM "authorization_codes"
          WHERE "expires_at" <= NOW()
             OR "consumed_at" IS NOT NULL
          LIMIT ${CLEANUP_BATCH_SIZE}
        )
      `,
    );
    const expiredProviderSessions = await runBatched(
      dataSource,
      `
        UPDATE "provider_sessions"
        SET "revoked_at" = COALESCE("revoked_at", NOW()),
            "revocation_reason" = COALESCE("revocation_reason", 'expired')
        WHERE "ctid" IN (
          SELECT "ctid" FROM "provider_sessions"
          WHERE "revoked_at" IS NULL
            AND (
              "idle_expires_at" <= NOW()
              OR "absolute_expires_at" <= NOW()
            )
          LIMIT ${CLEANUP_BATCH_SIZE}
        )
      `,
    );
    const expiredRefreshTokens = await runBatched(
      dataSource,
      `
        UPDATE "refresh_tokens"
        SET "revoked_at" = COALESCE("revoked_at", NOW()),
            "revocation_reason" = COALESCE("revocation_reason", 'expired')
        WHERE "ctid" IN (
          SELECT "ctid" FROM "refresh_tokens"
          WHERE "revoked_at" IS NULL
            AND (
              "idle_expires_at" <= NOW()
              OR "absolute_expires_at" <= NOW()
            )
          LIMIT ${CLEANUP_BATCH_SIZE}
        )
      `,
    );

    console.log(
      JSON.stringify(
        {
          status: 'ok',
          expiredAuthorizationCodes,
          expiredProviderSessions,
          expiredRefreshTokens,
        },
        null,
        2,
      ),
    );
  } finally {
    await dataSource.destroy();
  }
}

const CLEANUP_BATCH_SIZE = 1000;

async function runBatched(
  dataSource: DataSource,
  statement: string,
): Promise<number | null> {
  let total = 0;
  let sawUnknownShape = false;

  for (;;) {
    const affected = getAffectedCount(await dataSource.query(statement));

    if (affected === null) {
      sawUnknownShape = true;
      break;
    }

    total += affected;

    if (affected < CLEANUP_BATCH_SIZE) {
      break;
    }
  }

  return sawUnknownShape && total === 0 ? null : total;
}

function getAffectedCount(result: unknown): number | null {
  if (Array.isArray(result) && typeof result[1] === 'number') {
    return result[1];
  }

  return null;
}

void cleanupExpiredState().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
