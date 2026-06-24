import { AuditSeverity } from '../database/entities/audit-event.entity';
import {
  AuditEventTypes,
  type AuditEventRecordInput,
} from '../audit/audit.types';

export interface InternalAuditPluginOptions {
  recordAuditEvent: (input: AuditEventRecordInput) => Promise<string>;
}

export interface BetterAuthRouteContext {
  path?: string;
  params?: Record<string, unknown>;
}

export interface BetterAuthSessionRecord {
  id?: string;
  userId?: string;
  expiresAt?: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface InternalAuditPlugin {
  id: string;
  version: string;
  init(): {
    options: {
      databaseHooks: {
        session: {
          create: {
            after(
              this: void,
              session: BetterAuthSessionRecord | null,
              context: BetterAuthRouteContext | null,
            ): Promise<void>;
          };
        };
      };
    };
  };
}

export function createInternalAuditPlugin(
  options: InternalAuditPluginOptions,
): InternalAuditPlugin {
  return {
    id: 'internal-audit',
    version: '0.0.1',
    init() {
      return {
        options: {
          databaseHooks: {
            session: {
              create: {
                async after(
                  this: void,
                  session: BetterAuthSessionRecord | null,
                  context: BetterAuthRouteContext | null,
                ): Promise<void> {
                  if (!session?.userId) {
                    return;
                  }

                  await options.recordAuditEvent({
                    eventType: AuditEventTypes.UserLoginSucceeded,
                    severity: AuditSeverity.INFO,
                    actorUserId: session.userId,
                    ipAddress: session.ipAddress ?? null,
                    userAgent: session.userAgent ?? null,
                    metadata: {
                      sessionId: session.id ?? null,
                      authPath: context?.path ?? null,
                      loginMethod: resolveLoginMethodFromPath(
                        context?.path,
                        context?.params,
                      ),
                      sessionExpiresAt:
                        session.expiresAt instanceof Date
                          ? session.expiresAt.toISOString()
                          : null,
                    },
                  });
                },
              },
            },
          },
        },
      };
    },
  };
}

export function resolveLoginMethodFromPath(
  path?: string,
  params?: Record<string, unknown>,
): string | null {
  if (!path) {
    return null;
  }

  if (path === '/sign-in/email' || path === '/sign-up/email') {
    return 'email';
  }

  if (path.startsWith('/callback/') || path.startsWith('/oauth2/callback/')) {
    const provider =
      getStringParam(params, 'id') ??
      getStringParam(params, 'providerId') ??
      path.split('/').pop();

    return provider ?? null;
  }

  if (path.includes('passkey')) {
    return 'passkey';
  }

  if (path.includes('magic-link')) {
    return 'magic-link';
  }

  if (path.includes('siwe')) {
    return 'siwe';
  }

  return null;
}

function getStringParam(
  params: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = params?.[key];

  return typeof value === 'string' ? value : null;
}
