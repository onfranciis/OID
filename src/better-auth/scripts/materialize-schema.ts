import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { getMigrations } from 'better-auth/db/migration';
import { configuration } from '../../config/configuration';
import { createBetterAuthRuntime } from '../better-auth.factory';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

if (existsSync('.env.local')) {
  loadEnvFile('.env.local');
}

async function materializeBetterAuthSchema(): Promise<void> {
  const runtime = createBetterAuthRuntime(configuration());

  try {
    const migrations = await getMigrations(runtime.auth.options);
    const createdTables = migrations.toBeCreated.map((entry) => entry.table);
    const alteredTables = migrations.toBeAdded.map((entry) => ({
      table: entry.table,
      fields: Object.keys(entry.fields),
    }));

    if (createdTables.length === 0 && alteredTables.length === 0) {
      console.log(
        JSON.stringify(
          {
            changed: false,
            message: 'Better Auth schema is already up to date.',
          },
          null,
          2,
        ),
      );
      return;
    }

    await migrations.runMigrations();

    console.log(
      JSON.stringify(
        {
          changed: true,
          createdTables,
          alteredTables,
        },
        null,
        2,
      ),
    );
  } finally {
    await runtime.db.destroy();
  }
}

void materializeBetterAuthSchema().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
