import type { Request } from 'express';
import { parseCookies } from '../common/cookies';
import type { AuthenticationRequestContext } from './authentication.service';

export { parseCookies } from '../common/cookies';

export function buildRequestContext(
  req: Request,
): AuthenticationRequestContext {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
    headers: req.headers,
    cookies: parseCookies(req.headers.cookie),
  };
}
