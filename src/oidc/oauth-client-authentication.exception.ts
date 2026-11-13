import { UnauthorizedException } from '@nestjs/common';

/**
 * A client failed authentication at an OAuth endpoint.
 *
 * Kept separate from other UnauthorizedException usages so OAuthErrorFilter can
 * answer with `invalid_client` (RFC 6749 section 5.2) rather than `invalid_grant`.
 */
export class OAuthClientAuthenticationException extends UnauthorizedException {}
