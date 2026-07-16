import { Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthenticationService } from './authentication.service';
import { buildRequestContext } from './request-context';

@Controller()
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const result = await this.authenticationService.logout(
      buildRequestContext(req),
    );

    res.setHeader('set-cookie', result.responseHeaders);
    res.redirect(303, '/admin/login');
  }
}
