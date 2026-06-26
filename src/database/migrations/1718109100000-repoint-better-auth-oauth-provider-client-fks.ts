import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RepointBetterAuthOauthProviderClientFks1718109100000 implements MigrationInterface {
  name = 'RepointBetterAuthOauthProviderClientFks1718109100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner, 'oauthClient'))) {
      return;
    }

    if (await tableExists(queryRunner, 'oauthAccessToken')) {
      await backfillMissingOauthClients(queryRunner, 'oauthAccessToken');
      await repointClientForeignKeyToOauthClient(
        queryRunner,
        'oauthAccessToken',
        'oauthAccessToken_clientId_fkey',
      );
    }

    if (await tableExists(queryRunner, 'oauthConsent')) {
      await backfillMissingOauthClients(queryRunner, 'oauthConsent');
      await repointClientForeignKeyToOauthClient(
        queryRunner,
        'oauthConsent',
        'oauthConsent_clientId_fkey',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner, 'oauthApplication'))) {
      return;
    }

    if (await tableExists(queryRunner, 'oauthAccessToken')) {
      await repointClientForeignKeyToOauthApplication(
        queryRunner,
        'oauthAccessToken',
        'oauthAccessToken_clientId_fkey',
      );
    }

    if (await tableExists(queryRunner, 'oauthConsent')) {
      await repointClientForeignKeyToOauthApplication(
        queryRunner,
        'oauthConsent',
        'oauthConsent_clientId_fkey',
      );
    }
  }
}

async function repointClientForeignKeyToOauthClient(
  queryRunner: QueryRunner,
  tableName: string,
  constraintName: string,
): Promise<void> {
  const targetTable = await getForeignKeyTargetTable(
    queryRunner,
    tableName,
    constraintName,
  );

  if (targetTable === 'oauthClient') {
    return;
  }

  if (targetTable) {
    await queryRunner.query(
      `ALTER TABLE "${tableName}" DROP CONSTRAINT "${constraintName}"`,
    );
  }

  await queryRunner.query(`
    ALTER TABLE "${tableName}"
    ADD CONSTRAINT "${constraintName}"
    FOREIGN KEY ("clientId") REFERENCES "oauthClient"("clientId")
  `);
}

async function repointClientForeignKeyToOauthApplication(
  queryRunner: QueryRunner,
  tableName: string,
  constraintName: string,
): Promise<void> {
  const targetTable = await getForeignKeyTargetTable(
    queryRunner,
    tableName,
    constraintName,
  );

  if (targetTable === 'oauthApplication') {
    return;
  }

  if (targetTable) {
    await queryRunner.query(
      `ALTER TABLE "${tableName}" DROP CONSTRAINT "${constraintName}"`,
    );
  }

  await queryRunner.query(`
    ALTER TABLE "${tableName}"
    ADD CONSTRAINT "${constraintName}"
    FOREIGN KEY ("clientId") REFERENCES "oauthApplication"("clientId")
  `);
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

async function getForeignKeyTargetTable(
  queryRunner: QueryRunner,
  tableName: string,
  constraintName: string,
): Promise<string | null> {
  const rows = (await queryRunner.query(
    `
        SELECT ccu.table_name AS "foreign_table_name"
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = $1
          AND tc.constraint_name = $2
          AND tc.constraint_type = 'FOREIGN KEY'
      `,
    [tableName, constraintName],
  )) as Array<{ foreign_table_name: string | null }>;
  const [result] = rows;

  return result?.foreign_table_name ?? null;
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
