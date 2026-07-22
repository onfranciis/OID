import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AuditService } from '../audit/audit.service';
import { AppConfigService } from '../config/app-config.service';
import type { AppEnvironment } from '../config/app-environment';
import {
  createBetterAuthRuntime,
  type BetterAuthRuntime,
} from './better-auth.factory';

@Injectable()
export class BetterAuthService implements OnModuleDestroy {
  private readonly runtime: BetterAuthRuntime;
  private readonly baseUrl: string;
  private readonly nodeHandler: (
    req: IncomingMessage,
    res: ServerResponse,
  ) => Promise<void>;

  constructor(configService: AppConfigService, auditService: AuditService) {
    const appEnvironment: AppEnvironment = {
      app: {
        name: configService.get('app.name'),
        env: configService.get('app.env'),
        host: configService.get('app.host'),
        port: configService.get('app.port'),
        baseUrl: configService.get('app.baseUrl'),
      },
      database: {
        url: configService.get('database.url'),
        logging: configService.get('database.logging'),
      },
      betterAuth: {
        basePath: configService.get('betterAuth.basePath'),
        cookieName: configService.get('betterAuth.cookieName'),
        secret: configService.get('betterAuth.secret'),
        loginPath: configService.get('betterAuth.loginPath'),
        consentPath: configService.get('betterAuth.consentPath'),
      },
      authentication: {
        csrfCookieName: configService.get('authentication.csrfCookieName'),
        adminCsrfCookieName: configService.get(
          'authentication.adminCsrfCookieName',
        ),
        providerSessionCookieName: configService.get(
          'authentication.providerSessionCookieName',
        ),
        providerSessionIdleTtlSeconds: configService.get(
          'authentication.providerSessionIdleTtlSeconds',
        ),
        providerSessionAbsoluteTtlSeconds: configService.get(
          'authentication.providerSessionAbsoluteTtlSeconds',
        ),
        adminRecentAuthWindowSeconds: configService.get(
          'authentication.adminRecentAuthWindowSeconds',
        ),
        loginRateLimitWindowSeconds: configService.get(
          'authentication.loginRateLimitWindowSeconds',
        ),
        loginRateLimitIpMaxAttempts: configService.get(
          'authentication.loginRateLimitIpMaxAttempts',
        ),
        loginRateLimitAccountMaxAttempts: configService.get(
          'authentication.loginRateLimitAccountMaxAttempts',
        ),
        tokenRateLimitWindowSeconds: configService.get(
          'authentication.tokenRateLimitWindowSeconds',
        ),
        tokenRateLimitIpMaxAttempts: configService.get(
          'authentication.tokenRateLimitIpMaxAttempts',
        ),
      },
      mail: {
        resendApiKey: configService.get('mail.resendApiKey'),
        fromEmail: configService.get('mail.fromEmail'),
        inviteTtlHours: configService.get('mail.inviteTtlHours'),
        passwordResetTtlHours: configService.get('mail.passwordResetTtlHours'),
      },
      bootstrap: {
        adminEmail: configService.get('bootstrap.adminEmail'),
        adminDisplayName: configService.get('bootstrap.adminDisplayName'),
        adminGivenName: configService.get('bootstrap.adminGivenName'),
        adminFamilyName: configService.get('bootstrap.adminFamilyName'),
        adminUsername: configService.get('bootstrap.adminUsername'),
        adminPassword: configService.get('bootstrap.adminPassword'),
        adminGroupSlug: configService.get('bootstrap.adminGroupSlug'),
        adminGroupName: configService.get('bootstrap.adminGroupName'),
        clientId: configService.get('bootstrap.clientId'),
        clientName: configService.get('bootstrap.clientName'),
        clientSecret: configService.get('bootstrap.clientSecret'),
        clientRedirectUri: configService.get('bootstrap.clientRedirectUri'),
        clientPostLogoutRedirectUri: configService.get(
          'bootstrap.clientPostLogoutRedirectUri',
        ),
      },
    };

    this.baseUrl = appEnvironment.app.baseUrl;
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

  async dispatch(
    req: {
      method: string;
      originalUrl?: string;
      url: string;
      headers: Record<string, string | string[] | undefined>;
      body?: unknown;
    },
    overrides?: {
      body?: Record<string, unknown>;
    },
  ): Promise<Response> {
    const url = new URL(req.originalUrl ?? req.url, this.baseUrl);
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        headers.set(key, value.join(', '));
        continue;
      }

      headers.set(key, value);
    }

    const body =
      req.method === 'GET' || req.method === 'HEAD'
        ? undefined
        : serializeBody(overrides?.body ?? req.body, headers);

    return this.runtime.auth.handler(
      new Request(url, {
        method: req.method,
        headers,
        body,
      }),
    );
  }

  async signInWithEmail(input: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<Response> {
    const authApi = this.runtime.auth.api as {
      signInEmail: (context: {
        headers: Headers;
        body: {
          email: string;
          password: string;
          rememberMe?: boolean;
        };
        asResponse: true;
      }) => Promise<Response>;
    };
    const response = await authApi.signInEmail({
      headers: new Headers({
        origin: this.baseUrl,
      }),
      body: input,
      asResponse: true,
    });

    return response;
  }

  async changePassword(input: {
    currentPassword: string;
    newPassword: string;
    cookieHeader?: string;
  }): Promise<Response> {
    const authApi = this.runtime.auth.api as {
      changePassword: (context: {
        headers: Headers;
        body: {
          currentPassword: string;
          newPassword: string;
        };
        asResponse: true;
      }) => Promise<Response>;
    };
    const response = await authApi.changePassword({
      headers: new Headers({
        origin: this.baseUrl,
        ...(input.cookieHeader ? { cookie: input.cookieHeader } : {}),
      }),
      body: {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      },
      asResponse: true,
    });

    return response;
  }

  async signOut(input?: { cookieHeader?: string }): Promise<Response> {
    const authApi = this.runtime.auth.api as {
      signOut: (context: {
        headers: Headers;
        asResponse: true;
      }) => Promise<Response>;
    };
    const response = await authApi.signOut({
      headers: new Headers({
        origin: this.baseUrl,
        ...(input?.cookieHeader ? { cookie: input.cookieHeader } : {}),
      }),
      asResponse: true,
    });

    return response;
  }

  async onModuleDestroy(): Promise<void> {
    await this.runtime.db.destroy();
  }
}

function serializeBody(body: unknown, headers: Headers): string | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body === 'string') {
    return body;
  }

  if (body instanceof URLSearchParams) {
    headers.set('content-type', 'application/x-www-form-urlencoded');
    return body.toString();
  }

  if (typeof body === 'object') {
    headers.set('content-type', 'application/x-www-form-urlencoded');
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(
      body as Record<string, unknown>,
    )) {
      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const entry of value) {
          const serializedEntry = stringifyFormValue(entry);

          if (serializedEntry !== null) {
            params.append(key, serializedEntry);
          }
        }

        continue;
      }

      const serializedValue = stringifyFormValue(value);

      if (serializedValue !== null) {
        params.set(key, serializedValue);
      }
    }

    return params.toString();
  }

  return stringifyFormValue(body) ?? undefined;
}

function stringifyFormValue(value: unknown): string | null {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }

  return null;
}
