import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { BetterAuthService } from '../better-auth/better-auth.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { UserEntity, UserStatus } from '../database/entities/user.entity';
import { LoginPageService } from './login-page.service';
import { LoginRateLimitService } from './login-rate-limit.service';
import { ProviderSessionService } from './provider-session.service';

const GENERIC_LOGIN_ERROR = 'We could not sign you in with those credentials.';

export interface AuthenticationRequestContext {
  ipAddress: string | null;
  userAgent: string | null;
  headers: Record<string, string | string[] | undefined>;
  cookies: Record<string, string>;
}

export interface LoginPageResult {
  html: string;
  csrfCookieHeader: string;
}

export interface LoginSubmission {
  email: string;
  password: string;
  csrfToken: string;
  returnTo?: string | null;
}

export interface LoginResult {
  redirectTo: string;
  responseHeaders: string[];
}

export interface LogoutResult {
  responseHeaders: string[];
}

@Injectable()
export class AuthenticationService {
  private readonly csrfCookieName: string;
  private readonly csrfSecret: string;
  private readonly absoluteTtlSeconds: number;

  constructor(
    configService: ConfigService,
    private readonly loginPageService: LoginPageService,
    private readonly betterAuthService: BetterAuthService,
    private readonly auditService: AuditService,
    private readonly rateLimitService: LoginRateLimitService,
    private readonly providerSessionService: ProviderSessionService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {
    this.csrfCookieName = configService.getOrThrow<string>(
      'authentication.csrfCookieName',
    );
    this.csrfSecret = configService.getOrThrow<string>('betterAuth.secret');
    this.absoluteTtlSeconds = configService.getOrThrow<number>(
      'authentication.providerSessionAbsoluteTtlSeconds',
    );
  }

  renderLoginPage(
    returnTo: string | null,
    errorMessage?: string | null,
  ): LoginPageResult {
    const csrfToken = this.generateCsrfToken();

    return {
      html: this.loginPageService.renderLoginPage({
        csrfToken,
        errorMessage: errorMessage ?? null,
        returnTo,
      }),
      csrfCookieHeader: this.buildCsrfCookieHeader(csrfToken),
    };
  }

  async login(
    submission: LoginSubmission,
    context: AuthenticationRequestContext,
  ): Promise<LoginResult> {
    this.assertCsrf(submission.csrfToken, context.cookies[this.csrfCookieName]);

    const normalizedEmail = normalizeEmail(submission.email);
    this.rateLimitService.assertAllowed(context.ipAddress, normalizedEmail);

    const localUser = await this.userRepository.findOne({
      where: {
        normalizedEmail,
      },
    });

    if (!localUser) {
      await this.recordLoginFailure(
        context,
        normalizedEmail,
        null,
        'user_not_found',
      );
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    if (localUser.status !== UserStatus.ACTIVE) {
      await this.recordLoginFailure(
        context,
        normalizedEmail,
        localUser.id,
        `user_status_${localUser.status}`,
      );
      throw new ForbiddenException(GENERIC_LOGIN_ERROR);
    }

    const authResponse = await this.betterAuthService.dispatch({
      method: 'POST',
      originalUrl: '/api/auth/sign-in/email',
      url: '/api/auth/sign-in/email',
      headers: {
        ...context.headers,
        'content-type': 'application/json',
      },
      body: {
        email: normalizedEmail,
        password: submission.password,
      },
    });

    if (!authResponse.ok) {
      await this.recordLoginFailure(
        context,
        normalizedEmail,
        localUser.id,
        'invalid_credentials',
      );
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const authPayload = (await authResponse.json()) as {
      user?: {
        id?: string;
      };
    };

    if (authPayload.user?.id !== localUser.id) {
      await this.auditService.record({
        eventType: 'user.login.rejected',
        severity: AuditSeverity.CRITICAL,
        actorUserId: localUser.id,
        targetUserId: localUser.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          reason: 'better_auth_user_mismatch',
          betterAuthUserId: authPayload.user?.id ?? null,
          normalizedEmail,
        },
      });
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    this.rateLimitService.recordSuccess(context.ipAddress, normalizedEmail);

    const issuedSession = await this.providerSessionService.issue({
      userId: localUser.id,
      authTime: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    await this.auditService.record({
      eventType: 'user.login.succeeded',
      severity: AuditSeverity.INFO,
      actorUserId: localUser.id,
      targetUserId: localUser.id,
      providerSessionId: issuedSession.record.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        normalizedEmail,
        authTime: issuedSession.record.authTime.toISOString(),
      },
    });

    return {
      redirectTo: buildReturnTo(submission.returnTo),
      responseHeaders: [
        ...getSetCookieHeaders(authResponse.headers),
        this.providerSessionService.buildCookieHeader(
          issuedSession.token,
          this.absoluteTtlSeconds,
        ),
        this.buildCsrfCookieHeader(this.generateCsrfToken()),
      ],
    };
  }

  async logout(context: AuthenticationRequestContext): Promise<LogoutResult> {
    const responseHeaders: string[] = [];
    const localToken =
      context.cookies[this.providerSessionService.getCookieName()];

    if (localToken) {
      const revokedSession = await this.providerSessionService.revoke(
        localToken,
        'user_logout',
      );

      if (revokedSession) {
        await this.auditService.record({
          eventType: 'user.logout.succeeded',
          severity: AuditSeverity.INFO,
          actorUserId: revokedSession.userId,
          targetUserId: revokedSession.userId,
          providerSessionId: revokedSession.id,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: {
            reason: 'user_logout',
          },
        });
      }
    }

    const betterAuthResponse = await this.betterAuthService.dispatch({
      method: 'POST',
      originalUrl: '/api/auth/sign-out',
      url: '/api/auth/sign-out',
      headers: context.headers,
    });

    responseHeaders.push(...getSetCookieHeaders(betterAuthResponse.headers));
    responseHeaders.push(
      this.providerSessionService.buildClearedCookieHeader(),
    );
    responseHeaders.push(this.buildClearedCsrfCookieHeader());

    return {
      responseHeaders,
    };
  }

  private async recordLoginFailure(
    context: AuthenticationRequestContext,
    normalizedEmail: string,
    targetUserId: string | null,
    reason: string,
  ): Promise<void> {
    this.rateLimitService.recordFailure(context.ipAddress, normalizedEmail);

    await this.auditService.record({
      eventType: 'user.login.rejected',
      severity: AuditSeverity.WARNING,
      targetUserId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        normalizedEmail,
        reason,
      },
    });
  }

  private generateCsrfToken(): string {
    const nonce = randomBytes(16).toString('hex');
    const signature = createHash('sha256')
      .update(`${nonce}:${this.csrfSecret}`)
      .digest('hex');

    return `${nonce}.${signature}`;
  }

  private assertCsrf(submittedToken: string, cookieToken?: string): void {
    if (!cookieToken) {
      throw new ForbiddenException('Invalid CSRF token.');
    }

    const expectedSignature = createHash('sha256')
      .update(`${cookieToken.split('.')[0] ?? ''}:${this.csrfSecret}`)
      .digest('hex');
    const [cookieNonce = '', cookieSignature = ''] = cookieToken.split('.');
    const submittedBuffer = Buffer.from(submittedToken);
    const cookieBuffer = Buffer.from(cookieToken);
    const signatureBuffer = Buffer.from(cookieSignature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);

    if (
      cookieSignature.length === 0 ||
      signatureBuffer.length !== expectedSignatureBuffer.length ||
      submittedBuffer.length !== cookieBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedSignatureBuffer) ||
      !timingSafeEqual(submittedBuffer, cookieBuffer) ||
      cookieNonce.length === 0
    ) {
      throw new ForbiddenException('Invalid CSRF token.');
    }
  }

  private buildCsrfCookieHeader(token: string): string {
    return `${this.csrfCookieName}=${encodeURIComponent(token)}; Max-Age=900; Path=/; SameSite=Lax; HttpOnly; Secure`;
  }

  private buildClearedCsrfCookieHeader(): string {
    return `${this.csrfCookieName}=; Max-Age=0; Path=/; SameSite=Lax; HttpOnly; Secure`;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildReturnTo(returnTo?: string | null): string {
  if (!returnTo) {
    return '/';
  }

  if (returnTo.startsWith('/')) {
    return returnTo;
  }

  try {
    const parsedUrl = new URL(returnTo);
    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return '/';
  }
}

function getSetCookieHeaders(headers: Headers): string[] {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  const setCookie = headers.get('set-cookie');

  if (!setCookie) {
    return [];
  }

  return setCookie
    .split(/,(?=\s*[A-Za-z0-9_.-]+=)/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
