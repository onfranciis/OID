import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import { monotonicFactory } from 'ulid';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OidcProviderSessionEntity } from '../database/entities/oidc-provider-session.entity';

const nextUlid = monotonicFactory();

function prefixedUlid(prefix: string): string {
  return `${prefix}_${nextUlid().toLowerCase()}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface IssueProviderSessionInput {
  userId: string;
  authTime: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface IssuedProviderSession {
  record: OidcProviderSessionEntity;
  token: string;
}

@Injectable()
export class ProviderSessionService {
  private readonly idleTtlSeconds: number;
  private readonly absoluteTtlSeconds: number;
  private readonly cookieName: string;

  constructor(
    configService: ConfigService,
    @InjectRepository(OidcProviderSessionEntity)
    private readonly sessionRepository: Repository<OidcProviderSessionEntity>,
  ) {
    this.idleTtlSeconds = configService.getOrThrow<number>(
      'authentication.providerSessionIdleTtlSeconds',
    );
    this.absoluteTtlSeconds = configService.getOrThrow<number>(
      'authentication.providerSessionAbsoluteTtlSeconds',
    );
    this.cookieName = configService.getOrThrow<string>(
      'authentication.providerSessionCookieName',
    );
  }

  async issue(
    input: IssueProviderSessionInput,
  ): Promise<IssuedProviderSession> {
    const now = new Date();
    const token = randomBytes(32).toString('base64url');
    const record = this.sessionRepository.create({
      id: prefixedUlid('psn'),
      userId: input.userId,
      sessionHash: hashToken(token),
      createdAt: now,
      lastSeenAt: now,
      authTime: input.authTime,
      idleExpiresAt: new Date(now.getTime() + this.idleTtlSeconds * 1000),
      absoluteExpiresAt: new Date(
        now.getTime() + this.absoluteTtlSeconds * 1000,
      ),
      revokedAt: null,
      revocationReason: null,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.sessionRepository.save(record);

    return {
      record,
      token,
    };
  }

  async revoke(
    token: string,
    reason: string,
  ): Promise<OidcProviderSessionEntity | null> {
    const session = await this.sessionRepository.findOne({
      where: {
        sessionHash: hashToken(token),
      },
    });

    if (!session || session.revokedAt) {
      return null;
    }

    session.revokedAt = new Date();
    session.revocationReason = reason;

    await this.sessionRepository.save(session);

    return session;
  }

  buildCookieHeader(token: string, maxAgeSeconds: number): string {
    return serializeCookie(this.cookieName, token, {
      maxAgeSeconds,
      httpOnly: true,
      sameSite: 'Lax',
      secure: true,
      path: '/',
    });
  }

  buildClearedCookieHeader(): string {
    return serializeCookie(this.cookieName, '', {
      maxAgeSeconds: 0,
      httpOnly: true,
      sameSite: 'Lax',
      secure: true,
      path: '/',
    });
  }

  getCookieName(): string {
    return this.cookieName;
  }
}

interface CookieOptions {
  maxAgeSeconds: number;
  httpOnly: boolean;
  sameSite: 'Lax' | 'Strict' | 'None';
  secure: boolean;
  path: string;
}

function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions,
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${options.maxAgeSeconds}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
  ];

  if (options.httpOnly) {
    parts.push('HttpOnly');
  }

  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}
