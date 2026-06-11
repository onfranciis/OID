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

async function inspectBetterAuth(): Promise<void> {
  const runtime = createBetterAuthRuntime(configuration());

  try {
    const migrations = await getMigrations(runtime.auth.options);
    const pluginIds =
      runtime.auth.options.plugins?.map(
        (plugin: { id: string }) => plugin.id,
      ) ?? [];
    const endpointIds = Object.keys(runtime.auth.api);

    console.log(
      JSON.stringify(
        {
          pluginIds,
          endpointIds,
          toBeCreated: migrations.toBeCreated.map((entry) => entry.table),
          toBeAdded: migrations.toBeAdded.map((entry) => ({
            table: entry.table,
            fields: Object.keys(entry.fields),
          })),
          notes: {
            dynamicClientRegistrationBlockedByConfig: true,
            requirePkceConfigured: true,
            plainPkceBlockedByConfig: true,
            publicContractStillRequiresWrapperRoutes: true,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await runtime.db.destroy();
  }
}

void inspectBetterAuth().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
