import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

@Injectable()
export class AdminCsrfService {
  private readonly cookieName: string;
  private readonly csrfSecret: string;

  constructor(configService: ConfigService) {
    this.cookieName = configService.getOrThrow<string>(
      'authentication.csrfCookieName',
    );
    this.csrfSecret = configService.getOrThrow<string>('betterAuth.secret');
  }

  generateToken(): string {
    const nonce = randomBytes(16).toString('hex');
    const signature = createHash('sha256')
      .update(`${nonce}:${this.csrfSecret}`)
      .digest('hex');

    return `${nonce}.${signature}`;
  }

  assertToken(submittedToken: string | undefined, cookieToken?: string): void {
    if (!submittedToken || !cookieToken) {
      throw new ForbiddenException('Invalid CSRF token.');
    }

    const [cookieNonce = '', cookieSignature = ''] = cookieToken.split('.');
    const expectedSignature = createHash('sha256')
      .update(`${cookieNonce}:${this.csrfSecret}`)
      .digest('hex');
    const submittedBuffer = Buffer.from(submittedToken);
    const cookieBuffer = Buffer.from(cookieToken);
    const signatureBuffer = Buffer.from(cookieSignature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);

    if (
      cookieNonce.length === 0 ||
      cookieSignature.length === 0 ||
      signatureBuffer.length !== expectedSignatureBuffer.length ||
      submittedBuffer.length !== cookieBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedSignatureBuffer) ||
      !timingSafeEqual(submittedBuffer, cookieBuffer)
    ) {
      throw new ForbiddenException('Invalid CSRF token.');
    }
  }

  buildCookieHeader(token: string): string {
    return `${this.cookieName}=${encodeURIComponent(token)}; Max-Age=900; Path=/admin; SameSite=Lax; HttpOnly; Secure`;
  }

  getCookieName(): string {
    return this.cookieName;
  }
}
