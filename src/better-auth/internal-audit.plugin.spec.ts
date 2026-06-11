import { describe, expect, it, vi } from 'vitest';
import type { AuditEventRecordInput } from '../audit/audit.types';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import {
  createInternalAuditPlugin,
  type InternalAuditPlugin,
  resolveLoginMethodFromPath,
} from './internal-audit.plugin';

describe('createInternalAuditPlugin', () => {
  it('records successful session creation as a login audit event', async () => {
    const recordAuditEvent = vi.fn(() => Promise.resolve('evt_test'));
    const plugin: InternalAuditPlugin = createInternalAuditPlugin({
      recordAuditEvent,
    });
    const hook = plugin.init().options.databaseHooks.session.create.after;

    await hook(
      {
        id: 'sess_123',
        userId: 'usr_123',
        expiresAt: new Date('2026-06-11T16:00:00.000Z'),
        ipAddress: '127.0.0.1',
        userAgent: 'vitest-agent',
      },
      {
        path: '/sign-in/email',
      },
    );

    expect(recordAuditEvent).toHaveBeenCalledTimes(1);

    const firstCall = recordAuditEvent.mock.calls[0];
    const auditEvent = firstCall?.[0] as AuditEventRecordInput | undefined;

    expect(auditEvent).toMatchObject({
      eventType: 'user.login.succeeded',
      severity: AuditSeverity.INFO,
      actorUserId: 'usr_123',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest-agent',
      metadata: {
        sessionId: 'sess_123',
        authPath: '/sign-in/email',
        loginMethod: 'email',
      },
    });
  });
});

describe('resolveLoginMethodFromPath', () => {
  it('resolves provider callbacks to the provider identifier', () => {
    expect(
      resolveLoginMethodFromPath('/callback/google', { id: 'google' }),
    ).toBe('google');
  });

  it('returns null for unsupported paths', () => {
    expect(resolveLoginMethodFromPath('/unknown')).toBeNull();
  });
});
