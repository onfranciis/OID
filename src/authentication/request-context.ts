import type { Request } from 'express';
import type { AuthenticationRequestContext } from './authentication.service';

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

export function parseCookies(
  headerValue: string | undefined,
): Record<string, string> {
  if (!headerValue) {
    return {};
  }

  return Object.fromEntries(
    headerValue
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => {
        const separatorIndex = part.indexOf('=');

        if (separatorIndex === -1) {
          return [part, ''];
        }

        return [
          part.slice(0, separatorIndex),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ];
      }),
  );
}
