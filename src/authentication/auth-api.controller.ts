import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthenticationService } from './authentication.service';
import { buildRequestContext } from './request-context';

interface LoginBody {
  email?: string;
  password?: string;
  csrfToken?: string;
  returnTo?: string;
}

// JSON login API consumed by the React login page. Credential/CSRF/rate-limit
// failures surface as standard NestJS error responses so the SPA can render them
// inline instead of a server-rendered page reload.
@Controller('admin/api/auth')
export class AuthApiController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Get('login')
  initLogin(@Res({ passthrough: true }) res: Response): { csrfToken: string } {
    const { csrfToken, csrfCookieHeader } =
      this.authenticationService.initLogin();

    res.setHeader('set-cookie', csrfCookieHeader);

    return { csrfToken };
  }

  @Post('login')
  async login(
    @Req() req: Request,
    @Body() body: LoginBody,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ redirectTo: string }> {
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

    return { redirectTo: result.redirectTo };
  }
}
