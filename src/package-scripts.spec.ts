import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('package scripts', () => {
  const packageJson = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
  ) as {
    scripts: Record<string, string>;
  };

  it('exposes operations workflows', () => {
    expect(packageJson.scripts['dependency:audit']).toBe(
      'pnpm audit --audit-level moderate',
    );
    expect(packageJson.scripts.typecheck).toBe('tsc --noEmit -p tsconfig.json');
    expect(packageJson.scripts['start:prod:migrate']).toBe(
      'pnpm migration:run && node dist/src/main',
    );
    expect(packageJson.scripts['sample-client:start']).toContain(
      'sample-client/src/server.ts',
    );
    expect(packageJson.scripts['test:migrations']).toBe(
      'pnpm migration:verify',
    );
    expect(packageJson.scripts['migration:verify']).toContain(
      'src/database/scripts/verify-migrations.ts',
    );
    expect(packageJson.scripts['cleanup:expired']).toContain(
      'src/database/scripts/cleanup-expired.ts',
    );
  });
});
