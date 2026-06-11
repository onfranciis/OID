import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toNodeHandler } from 'better-auth/node';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AuditService } from '../audit/audit.service';
import type { AppEnvironment } from '../config/app-environment';
import {
  createBetterAuthRuntime,
  type BetterAuthRuntime,
} from './better-auth.factory';

@Injectable()
export class BetterAuthService implements OnModuleDestroy {
  private readonly runtime: BetterAuthRuntime;
  private readonly nodeHandler: (
    req: IncomingMessage,
    res: ServerResponse,
  ) => Promise<void>;

  constructor(configService: ConfigService, auditService: AuditService) {
    const appEnvironment: AppEnvironment = {
      app: {
        name: configService.getOrThrow<string>('app.name'),
        env: configService.getOrThrow<AppEnvironment['app']['env']>('app.env'),
        host: configService.getOrThrow<string>('app.host'),
        port: configService.getOrThrow<number>('app.port'),
        baseUrl: configService.getOrThrow<string>('app.baseUrl'),
      },
      database: {
        url: configService.getOrThrow<string>('database.url'),
        logging: configService.get<boolean>('database.logging') ?? false,
      },
      betterAuth: {
        basePath: configService.getOrThrow<string>('betterAuth.basePath'),
        cookieName: configService.getOrThrow<string>('betterAuth.cookieName'),
        secret: configService.getOrThrow<string>('betterAuth.secret'),
        loginPath: configService.getOrThrow<string>('betterAuth.loginPath'),
      },
      bootstrap: {
        adminEmail: configService.getOrThrow<string>('bootstrap.adminEmail'),
        adminDisplayName: configService.getOrThrow<string>(
          'bootstrap.adminDisplayName',
        ),
        adminGivenName:
          configService.get<string>('bootstrap.adminGivenName') ?? null,
        adminFamilyName:
          configService.get<string>('bootstrap.adminFamilyName') ?? null,
        adminUsername:
          configService.get<string>('bootstrap.adminUsername') ?? null,
        adminGroupSlug: configService.getOrThrow<string>(
          'bootstrap.adminGroupSlug',
        ),
        adminGroupName: configService.getOrThrow<string>(
          'bootstrap.adminGroupName',
        ),
        clientId: configService.getOrThrow<string>('bootstrap.clientId'),
        clientName: configService.getOrThrow<string>('bootstrap.clientName'),
        clientRedirectUri: configService.getOrThrow<string>(
          'bootstrap.clientRedirectUri',
        ),
        clientPostLogoutRedirectUri: configService.getOrThrow<string>(
          'bootstrap.clientPostLogoutRedirectUri',
        ),
      },
    };

    this.runtime = createBetterAuthRuntime(appEnvironment, {
      recordAuditEvent: (input) => auditService.record(input),
    });
    this.nodeHandler = toNodeHandler(this.runtime.auth);
  }

  getAuth(): BetterAuthRuntime['auth'] {
    return this.runtime.auth;
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    await this.nodeHandler(req, res);
  }

  async onModuleDestroy(): Promise<void> {
    await this.runtime.db.destroy();
  }
}
