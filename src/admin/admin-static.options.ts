import type { ServeStaticModuleOptions } from '@nestjs/serve-static';
import { join } from 'node:path';

export const ADMIN_SERVE_ROOT = '/admin';
// Excluded from the SPA fallback so it reaches AdminApiController instead.
export const ADMIN_API_EXCLUDE = '/admin/api/{*path}';

export function adminStaticOptions(
  rootPath: string = join(process.cwd(), 'web', 'admin', 'dist'),
): ServeStaticModuleOptions {
  return {
    rootPath,
    serveRoot: ADMIN_SERVE_ROOT,
    exclude: [ADMIN_API_EXCLUDE],
  };
}
