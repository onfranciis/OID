import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { configuration } from '../../config/configuration';
import { createTypeOrmOptions } from '../typeorm.config';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

if (existsSync('.env.local')) {
  loadEnvFile('.env.local');
}

function getAdminDatabaseUrl(databaseUrl: URL): URL {
  const adminUrl = new URL(databaseUrl.toString());
  adminUrl.pathname = '/postgres';
  return adminUrl;
}

async function verifyMigrations(): Promise<void> {
  const appEnvironment = configuration();
  const baseDatabaseUrl = new URL(appEnvironment.database.url);
  const tempDatabaseName = `internal_id_verify_${randomUUID().replaceAll('-', '_')}`;
  const adminClient = new Client({
    connectionString: getAdminDatabaseUrl(baseDatabaseUrl).toString(),
  });

  await adminClient.connect();

  try {
    await adminClient.query(`CREATE DATABASE "${tempDatabaseName}"`);

    const verificationUrl = new URL(baseDatabaseUrl.toString());
    verificationUrl.pathname = `/${tempDatabaseName}`;

    const verificationDataSource = new DataSource(
      createTypeOrmOptions({
        ...appEnvironment,
        database: {
          ...appEnvironment.database,
          url: verificationUrl.toString(),
        },
      }),
    );

    await verificationDataSource.initialize();

    try {
      await verificationDataSource.runMigrations();
      await verificationDataSource.undoLastMigration();
    } finally {
      await verificationDataSource.destroy();
    }

    await adminClient.query(`DROP DATABASE "${tempDatabaseName}" WITH (FORCE)`);

    console.log(
      JSON.stringify(
        {
          status: 'ok',
          database: tempDatabaseName,
          verification: 'migration run and rollback succeeded',
        },
        null,
        2,
      ),
    );
  } finally {
    await adminClient.end();
  }
}

void verifyMigrations().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
