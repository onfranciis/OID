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
  private readonly baseUrl: string;
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
        consentPath: configService.getOrThrow<string>('betterAuth.consentPath'),
      },
      authentication: {
        csrfCookieName: configService.getOrThrow<string>(
          'authentication.csrfCookieName',
        ),
        providerSessionCookieName: configService.getOrThrow<string>(
          'authentication.providerSessionCookieName',
        ),
        providerSessionIdleTtlSeconds: configService.getOrThrow<number>(
          'authentication.providerSessionIdleTtlSeconds',
        ),
        providerSessionAbsoluteTtlSeconds: configService.getOrThrow<number>(
          'authentication.providerSessionAbsoluteTtlSeconds',
        ),
        adminRecentAuthWindowSeconds: configService.getOrThrow<number>(
          'authentication.adminRecentAuthWindowSeconds',
        ),
        loginRateLimitWindowSeconds: configService.getOrThrow<number>(
          'authentication.loginRateLimitWindowSeconds',
        ),
        loginRateLimitIpMaxAttempts: configService.getOrThrow<number>(
          'authentication.loginRateLimitIpMaxAttempts',
        ),
        loginRateLimitAccountMaxAttempts: configService.getOrThrow<number>(
          'authentication.loginRateLimitAccountMaxAttempts',
        ),
        tokenRateLimitWindowSeconds: configService.getOrThrow<number>(
          'authentication.tokenRateLimitWindowSeconds',
        ),
        tokenRateLimitIpMaxAttempts: configService.getOrThrow<number>(
          'authentication.tokenRateLimitIpMaxAttempts',
        ),
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
        adminPassword:
          configService.get<string>('bootstrap.adminPassword') ?? null,
        adminGroupSlug: configService.getOrThrow<string>(
          'bootstrap.adminGroupSlug',
        ),
        adminGroupName: configService.getOrThrow<string>(
          'bootstrap.adminGroupName',
        ),
        clientId: configService.getOrThrow<string>('bootstrap.clientId'),
        clientName: configService.getOrThrow<string>('bootstrap.clientName'),
        clientSecret:
          configService.get<string>('bootstrap.clientSecret') ?? null,
        clientRedirectUri: configService.getOrThrow<string>(
          'bootstrap.clientRedirectUri',
        ),
        clientPostLogoutRedirectUri: configService.getOrThrow<string>(
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
