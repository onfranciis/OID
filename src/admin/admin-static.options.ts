import type { ServeStaticModuleOptions } from '@nestjs/serve-static';
import { join } from 'node:path';

// Same-origin serving for the React admin SPA (FRONTEND_ROADMAP.md, phase F6).
// The Vite build (base `/admin/`) is served at `/admin` with SPA fallback, while
// `/admin/api/*` is excluded so it falls through to AdminApiController.
export const ADMIN_SERVE_ROOT = '/admin';
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
