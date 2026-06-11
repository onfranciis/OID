import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthenticationService } from './authentication.service';

interface LoginBody {
  email?: string;
  password?: string;
  csrfToken?: string;
  returnTo?: string;
}

@Controller()
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Get('login')
  getLoginPage(
    @Query('returnTo') returnTo: string | undefined,
    @Res() res: Response,
  ): void {
    const result = this.authenticationService.renderLoginPage(returnTo ?? null);

    res.setHeader('set-cookie', result.csrfCookieHeader);
    res.type('html').send(result.html);
  }

  @Post('login')
  async login(
    @Req() req: Request,
    @Body() body: LoginBody,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.authenticationService.login(
      {
        email: body.email ?? '',
        password: body.password ?? '',
        csrfToken: body.csrfToken ?? '',
        returnTo: body.returnTo ?? null,
      },
      buildRequestContext(req),
    );

    res.setHeader('set-cookie', result.responseHeaders);
    res.redirect(303, result.redirectTo);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const result = await this.authenticationService.logout(
      buildRequestContext(req),
    );

    res.setHeader('set-cookie', result.responseHeaders);
    res.redirect(303, '/login');
  }
}

function buildRequestContext(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
    headers: req.headers,
    cookies: parseCookies(req.headers.cookie),
  };
}

function parseCookies(headerValue: string | undefined): Record<string, string> {
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
