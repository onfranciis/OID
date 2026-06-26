import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignBetterAuthOauthProviderSchema1718109000000 implements MigrationInterface {
  name = 'AlignBetterAuthOauthProviderSchema1718109000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner, 'user'))) {
      return;
    }

    if (!(await tableExists(queryRunner, 'session'))) {
      return;
    }

    await createOauthProviderMigrationHelpers(queryRunner);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "oauthClient" (
        "id" text NOT NULL,
        "clientId" text NOT NULL,
        "clientSecret" text,
        "disabled" boolean,
        "skipConsent" boolean,
        "enableEndSession" boolean,
        "subjectType" text,
        "scopes" jsonb,
        "userId" text,
        "createdAt" TIMESTAMPTZ,
        "updatedAt" TIMESTAMPTZ,
        "name" text,
        "uri" text,
        "icon" text,
        "contacts" jsonb,
        "tos" text,
        "policy" text,
        "softwareId" text,
        "softwareVersion" text,
        "softwareStatement" text,
        "redirectUris" jsonb NOT NULL,
        "postLogoutRedirectUris" jsonb,
        "tokenEndpointAuthMethod" text,
        "grantTypes" jsonb,
        "responseTypes" jsonb,
        "public" boolean,
        "type" text,
        "requirePKCE" boolean,
        "referenceId" text,
        "metadata" jsonb,
        CONSTRAINT "oauthClient_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "oauthClient_clientId_key" UNIQUE ("clientId")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "oauthClient_userId_idx" ON "oauthClient" ("userId")`,
    );

    await addForeignKeyIfMissing(
      queryRunner,
      'oauthClient',
      'oauthClient_userId_fkey',
      `ALTER TABLE "oauthClient"
       ADD CONSTRAINT "oauthClient_userId_fkey"
       FOREIGN KEY ("userId") REFERENCES "user"("id")`,
    );

    if (await tableExists(queryRunner, 'oauthApplication')) {
      await queryRunner.query(`
        INSERT INTO "oauthClient" (
          "id",
          "clientId",
          "clientSecret",
          "disabled",
          "userId",
          "createdAt",
          "updatedAt",
          "name",
          "icon",
          "redirectUris",
          "type",
          "metadata"
        )
        SELECT
          "id",
          "clientId",
          "clientSecret",
          "disabled",
          "userId",
          "createdAt",
          "updatedAt",
          "name",
          "icon",
          better_auth_oauth_text_to_json_array("redirectUrls"),
          "type",
          CASE
            WHEN "metadata" IS NULL THEN NULL
            ELSE to_jsonb("metadata")
          END
        FROM "oauthApplication"
        ON CONFLICT ("clientId") DO NOTHING
      `);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "oauthRefreshToken" (
        "id" text NOT NULL,
        "token" text NOT NULL,
        "clientId" text NOT NULL,
        "sessionId" text,
        "userId" text NOT NULL,
        "referenceId" text,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL,
        "revoked" TIMESTAMPTZ,
        "authTime" TIMESTAMPTZ,
        "scopes" jsonb NOT NULL,
        CONSTRAINT "oauthRefreshToken_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "oauthRefreshToken_token_key" UNIQUE ("token")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "oauthRefreshToken_clientId_idx" ON "oauthRefreshToken" ("clientId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "oauthRefreshToken_sessionId_idx" ON "oauthRefreshToken" ("sessionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "oauthRefreshToken_userId_idx" ON "oauthRefreshToken" ("userId")`,
    );

    await addForeignKeyIfMissing(
      queryRunner,
      'oauthRefreshToken',
      'oauthRefreshToken_clientId_fkey',
      `ALTER TABLE "oauthRefreshToken"
       ADD CONSTRAINT "oauthRefreshToken_clientId_fkey"
       FOREIGN KEY ("clientId") REFERENCES "oauthClient"("clientId")`,
    );
    await addForeignKeyIfMissing(
      queryRunner,
      'oauthRefreshToken',
      'oauthRefreshToken_sessionId_fkey',
      `ALTER TABLE "oauthRefreshToken"
       ADD CONSTRAINT "oauthRefreshToken_sessionId_fkey"
       FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE SET NULL`,
    );
    await addForeignKeyIfMissing(
      queryRunner,
      'oauthRefreshToken',
      'oauthRefreshToken_userId_fkey',
      `ALTER TABLE "oauthRefreshToken"
       ADD CONSTRAINT "oauthRefreshToken_userId_fkey"
       FOREIGN KEY ("userId") REFERENCES "user"("id")`,
    );

    if (await tableExists(queryRunner, 'oauthAccessToken')) {
      await addOauthAccessTokenColumns(queryRunner);
      await backfillMissingOauthClients(queryRunner, 'oauthAccessToken');
      await convertScopesTextColumnToJsonb(queryRunner, 'oauthAccessToken');
      await addOauthAccessTokenConstraints(queryRunner);
    }

    if (await tableExists(queryRunner, 'oauthConsent')) {
      await queryRunner.query(`
        ALTER TABLE "oauthConsent"
        ADD COLUMN IF NOT EXISTS "referenceId" text
      `);
      await backfillMissingOauthClients(queryRunner, 'oauthConsent');
      await convertScopesTextColumnToJsonb(queryRunner, 'oauthConsent');
      await addOauthConsentConstraints(queryRunner);
    }

    await dropOauthProviderMigrationHelpers(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await createOauthProviderMigrationHelpers(queryRunner);

    if (await tableExists(queryRunner, 'oauthAccessToken')) {
      await dropForeignKeyIfExists(
        queryRunner,
        'oauthAccessToken',
        'oauthAccessToken_refreshId_fkey',
      );
      await dropForeignKeyIfExists(
        queryRunner,
        'oauthAccessToken',
        'oauthAccessToken_sessionId_fkey',
      );
      await dropForeignKeyIfExists(
        queryRunner,
        'oauthAccessToken',
        'oauthAccessToken_clientId_fkey',
      );
      await convertScopesJsonbColumnToText(queryRunner, 'oauthAccessToken');
      await queryRunner.query(
        `DROP INDEX IF EXISTS "oauthAccessToken_refreshId_idx"`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS "oauthAccessToken_sessionId_idx"`,
      );
      await queryRunner.query(
        `ALTER TABLE "oauthAccessToken" DROP CONSTRAINT IF EXISTS "oauthAccessToken_token_key"`,
      );
      await queryRunner.query(`
        ALTER TABLE "oauthAccessToken"
        DROP COLUMN IF EXISTS "token",
        DROP COLUMN IF EXISTS "sessionId",
        DROP COLUMN IF EXISTS "referenceId",
        DROP COLUMN IF EXISTS "refreshId",
        DROP COLUMN IF EXISTS "expiresAt"
      `);
    }

    if (await tableExists(queryRunner, 'oauthConsent')) {
      await dropForeignKeyIfExists(
        queryRunner,
        'oauthConsent',
        'oauthConsent_clientId_fkey',
      );
      await convertScopesJsonbColumnToText(queryRunner, 'oauthConsent');
      await queryRunner.query(`
        ALTER TABLE "oauthConsent"
        DROP COLUMN IF EXISTS "referenceId"
      `);
    }

    if (await tableExists(queryRunner, 'oauthRefreshToken')) {
      await dropForeignKeyIfExists(
        queryRunner,
        'oauthRefreshToken',
        'oauthRefreshToken_clientId_fkey',
      );
      await dropForeignKeyIfExists(
        queryRunner,
        'oauthRefreshToken',
        'oauthRefreshToken_sessionId_fkey',
      );
      await dropForeignKeyIfExists(
        queryRunner,
        'oauthRefreshToken',
        'oauthRefreshToken_userId_fkey',
      );
      await queryRunner.query(`DROP TABLE "oauthRefreshToken"`);
    }

    if (await tableExists(queryRunner, 'oauthClient')) {
      await dropForeignKeyIfExists(
        queryRunner,
        'oauthClient',
        'oauthClient_userId_fkey',
      );
      await queryRunner.query(`DROP TABLE "oauthClient"`);
    }

    await dropOauthProviderMigrationHelpers(queryRunner);
  }
}

async function addOauthAccessTokenColumns(
  queryRunner: QueryRunner,
): Promise<void> {
  await queryRunner.query(`
    ALTER TABLE "oauthAccessToken"
    ADD COLUMN IF NOT EXISTS "token" text,
    ADD COLUMN IF NOT EXISTS "sessionId" text,
    ADD COLUMN IF NOT EXISTS "referenceId" text,
    ADD COLUMN IF NOT EXISTS "refreshId" text,
    ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ
  `);
  await queryRunner.query(`
    UPDATE "oauthAccessToken"
    SET
      "token" = COALESCE("token", "accessToken"),
      "expiresAt" = COALESCE("expiresAt", "accessTokenExpiresAt")
    WHERE "token" IS NULL OR "expiresAt" IS NULL
  `);
  await queryRunner.query(`
    ALTER TABLE "oauthAccessToken"
    ALTER COLUMN "token" SET NOT NULL,
    ALTER COLUMN "expiresAt" SET NOT NULL
  `);
}

async function addOauthAccessTokenConstraints(
  queryRunner: QueryRunner,
): Promise<void> {
  await addForeignKeyIfMissing(
    queryRunner,
    'oauthAccessToken',
    'oauthAccessToken_token_key',
    `ALTER TABLE "oauthAccessToken"
     ADD CONSTRAINT "oauthAccessToken_token_key" UNIQUE ("token")`,
  );
  await queryRunner.query(
    `CREATE INDEX IF NOT EXISTS "oauthAccessToken_sessionId_idx" ON "oauthAccessToken" ("sessionId")`,
  );
  await queryRunner.query(
    `CREATE INDEX IF NOT EXISTS "oauthAccessToken_refreshId_idx" ON "oauthAccessToken" ("refreshId")`,
  );
  await addForeignKeyIfMissing(
    queryRunner,
    'oauthAccessToken',
    'oauthAccessToken_clientId_fkey',
    `ALTER TABLE "oauthAccessToken"
     ADD CONSTRAINT "oauthAccessToken_clientId_fkey"
     FOREIGN KEY ("clientId") REFERENCES "oauthClient"("clientId")`,
  );
  await addForeignKeyIfMissing(
    queryRunner,
    'oauthAccessToken',
    'oauthAccessToken_sessionId_fkey',
    `ALTER TABLE "oauthAccessToken"
     ADD CONSTRAINT "oauthAccessToken_sessionId_fkey"
     FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE SET NULL`,
  );
  await addForeignKeyIfMissing(
    queryRunner,
    'oauthAccessToken',
    'oauthAccessToken_refreshId_fkey',
    `ALTER TABLE "oauthAccessToken"
     ADD CONSTRAINT "oauthAccessToken_refreshId_fkey"
     FOREIGN KEY ("refreshId") REFERENCES "oauthRefreshToken"("id")`,
  );
}

async function addOauthConsentConstraints(
  queryRunner: QueryRunner,
): Promise<void> {
  await addForeignKeyIfMissing(
    queryRunner,
    'oauthConsent',
    'oauthConsent_clientId_fkey',
    `ALTER TABLE "oauthConsent"
     ADD CONSTRAINT "oauthConsent_clientId_fkey"
     FOREIGN KEY ("clientId") REFERENCES "oauthClient"("clientId")`,
  );
}

async function backfillMissingOauthClients(
  queryRunner: QueryRunner,
  sourceTable: string,
): Promise<void> {
  await queryRunner.query(`
    INSERT INTO "oauthClient" (
      "id",
      "clientId",
      "createdAt",
      "updatedAt",
      "redirectUris"
    )
    SELECT
      'migrated_' || md5(source."clientId"),
      source."clientId",
      now(),
      now(),
      '[]'::jsonb
    FROM (SELECT DISTINCT "clientId" FROM "${sourceTable}") source
    WHERE source."clientId" IS NOT NULL
    ON CONFLICT ("clientId") DO NOTHING
  `);
}

async function convertScopesTextColumnToJsonb(
  queryRunner: QueryRunner,
  tableName: string,
): Promise<void> {
  const columnType = await getColumnUdtName(queryRunner, tableName, 'scopes');

  if (columnType !== 'text') {
    return;
  }

  await queryRunner.query(`
    ALTER TABLE "${tableName}"
    ALTER COLUMN "scopes" TYPE jsonb
    USING better_auth_oauth_text_to_json_array("scopes")
  `);
}

async function convertScopesJsonbColumnToText(
  queryRunner: QueryRunner,
  tableName: string,
): Promise<void> {
  const columnType = await getColumnUdtName(queryRunner, tableName, 'scopes');

  if (columnType !== 'jsonb') {
    return;
  }

  await queryRunner.query(`
    ALTER TABLE "${tableName}"
    ALTER COLUMN "scopes" TYPE text
    USING better_auth_oauth_json_array_to_text("scopes")
  `);
}

async function createOauthProviderMigrationHelpers(
  queryRunner: QueryRunner,
): Promise<void> {
  await queryRunner.query(`
    CREATE OR REPLACE FUNCTION better_auth_oauth_text_to_json_array(input text)
    RETURNS jsonb
    LANGUAGE sql
    IMMUTABLE
    AS $$
      SELECT CASE
        WHEN input IS NULL OR btrim(input) = '' THEN '[]'::jsonb
        WHEN left(btrim(input), 1) = '[' THEN input::jsonb
        ELSE to_jsonb(regexp_split_to_array(btrim(input), '\\s+'))
      END
    $$
  `);
  await queryRunner.query(`
    CREATE OR REPLACE FUNCTION better_auth_oauth_json_array_to_text(input jsonb)
    RETURNS text
    LANGUAGE sql
    IMMUTABLE
    AS $$
      SELECT COALESCE(string_agg(value, ' '), '')
      FROM jsonb_array_elements_text(COALESCE(input, '[]'::jsonb)) AS value
    $$
  `);
}

async function dropOauthProviderMigrationHelpers(
  queryRunner: QueryRunner,
): Promise<void> {
  await queryRunner.query(
    `DROP FUNCTION IF EXISTS better_auth_oauth_text_to_json_array(text)`,
  );
  await queryRunner.query(
    `DROP FUNCTION IF EXISTS better_auth_oauth_json_array_to_text(jsonb)`,
  );
}

async function addForeignKeyIfMissing(
  queryRunner: QueryRunner,
  tableName: string,
  constraintName: string,
  sql: string,
): Promise<void> {
  const exists = await constraintExists(queryRunner, tableName, constraintName);

  if (!exists) {
    await queryRunner.query(sql);
  }
}

async function dropForeignKeyIfExists(
  queryRunner: QueryRunner,
  tableName: string,
  constraintName: string,
): Promise<void> {
  const exists = await constraintExists(queryRunner, tableName, constraintName);

  if (exists) {
    await queryRunner.query(
      `ALTER TABLE "${tableName}" DROP CONSTRAINT "${constraintName}"`,
    );
  }
}

async function tableExists(
  queryRunner: QueryRunner,
  tableName: string,
): Promise<boolean> {
  const rows = (await queryRunner.query(
    `SELECT to_regclass($1) IS NOT NULL AS "exists"`,
    [`public."${tableName}"`],
  )) as Array<{ exists: boolean }>;
  const [result] = rows;

  return result?.exists ?? false;
}

async function constraintExists(
  queryRunner: QueryRunner,
  tableName: string,
  constraintName: string,
): Promise<boolean> {
  const rows = (await queryRunner.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = $1
          AND constraint_name = $2
      ) AS "exists"
    `,
    [tableName, constraintName],
  )) as Array<{ exists: boolean }>;
  const [result] = rows;

  return result?.exists ?? false;
}

async function getColumnUdtName(
  queryRunner: QueryRunner,
  tableName: string,
  columnName: string,
): Promise<string | null> {
  const rows = (await queryRunner.query(
    `
      SELECT udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    `,
    [tableName, columnName],
  )) as Array<{ udt_name: string }>;
  const [result] = rows;

  return result?.udt_name ?? null;
}
