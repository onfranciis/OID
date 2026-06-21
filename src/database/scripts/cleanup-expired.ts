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
    const expiredAuthorizationCodes: unknown = await dataSource.query(
      `
        DELETE FROM "authorization_codes"
        WHERE "expires_at" <= NOW()
           OR "consumed_at" IS NOT NULL
      `,
    );
    const expiredProviderSessions: unknown = await dataSource.query(
      `
        UPDATE "provider_sessions"
        SET "revoked_at" = COALESCE("revoked_at", NOW()),
            "revocation_reason" = COALESCE("revocation_reason", 'expired')
        WHERE "revoked_at" IS NULL
          AND (
            "idle_expires_at" <= NOW()
            OR "absolute_expires_at" <= NOW()
          )
      `,
    );
    const expiredRefreshTokens: unknown = await dataSource.query(
      `
        UPDATE "refresh_tokens"
        SET "revoked_at" = COALESCE("revoked_at", NOW()),
            "revocation_reason" = COALESCE("revocation_reason", 'expired')
        WHERE "revoked_at" IS NULL
          AND (
            "idle_expires_at" <= NOW()
            OR "absolute_expires_at" <= NOW()
          )
      `,
    );

    console.log(
      JSON.stringify(
        {
          status: 'ok',
          expiredAuthorizationCodes: getAffectedCount(
            expiredAuthorizationCodes,
          ),
          expiredProviderSessions: getAffectedCount(expiredProviderSessions),
          expiredRefreshTokens: getAffectedCount(expiredRefreshTokens),
        },
        null,
        2,
      ),
    );
  } finally {
    await dataSource.destroy();
  }
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
