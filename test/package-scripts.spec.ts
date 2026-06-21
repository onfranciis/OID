import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('package scripts', () => {
  const packageJson = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
  ) as {
    scripts: Record<string, string>;
  };

  it('exposes dependency audit and migration verification workflows', () => {
    expect(packageJson.scripts['dependency:audit']).toBe(
      'pnpm audit --audit-level moderate',
    );
    expect(packageJson.scripts['test:migrations']).toBe(
      'pnpm migration:verify',
    );
    expect(packageJson.scripts['migration:verify']).toContain(
      'src/database/scripts/verify-migrations.ts',
    );
  });
});
