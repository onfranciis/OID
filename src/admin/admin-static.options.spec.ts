import { Controller, Get, Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { mkdtempSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_API_EXCLUDE, adminStaticOptions } from './admin-static.options';

// Stands in for AdminApiController so we can prove /admin/api falls through to a
// controller instead of being shadowed by the SPA fallback.
@Controller('admin/api')
class StubAdminApiController {
  @Get('session')
  session() {
    return { ok: true };
  }
}

async function get(app: INestApplication, path: string) {
  const server = app.getHttpServer() as Server;
  const { port } = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}${path}`);

  return { status: response.status, body: await response.text() };
}

describe('admin static serving', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const root = mkdtempSync(join(tmpdir(), 'admin-dist-'));
    writeFileSync(
      join(root, 'index.html'),
      '<!doctype html><title>Internal ID Admin</title><div id="root"></div>',
    );
    writeFileSync(join(root, 'app.js'), 'console.log("asset");');

    @Module({
      imports: [ServeStaticModule.forRoot(adminStaticOptions(root))],
      controllers: [StubAdminApiController],
    })
    class TestModule {}

    app = await NestFactory.create(TestModule, { logger: false });
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the SPA index at the /admin root', async () => {
    const response = await get(app, '/admin/');

    expect(response.status).toBe(200);
    expect(response.body).toContain('Internal ID Admin');
  });

  it('serves real asset files under /admin', async () => {
    const response = await get(app, '/admin/app.js');

    expect(response.status).toBe(200);
    expect(response.body).toContain('asset');
  });

  it('falls back to index.html for client-side deep links', async () => {
    const response = await get(app, '/admin/users/usr_1');

    expect(response.status).toBe(200);
    expect(response.body).toContain('id="root"');
  });

  it('lets /admin/api/* fall through to the API controller', async () => {
    const response = await get(app, '/admin/api/session');

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });

  it('serves the client-rendered /admin/login route from the SPA', async () => {
    const response = await get(app, '/admin/login');

    expect(response.status).toBe(200);
    expect(response.body).toContain('id="root"');
  });

  it('excludes only the API so the fallback never shadows it', () => {
    expect(adminStaticOptions('/tmp/x').exclude).toEqual([ADMIN_API_EXCLUDE]);
  });
});
