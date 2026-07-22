import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  PasswordResetService,
  type PasswordResetSummary,
} from './password-reset.service';

interface ForgotPasswordBody {
  email?: string;
}

interface ResetPasswordBody {
  password?: string;
}

// No CSRF cookie here (unlike login): the emailed token is itself the bearer
// secret, same trust model as the invite-accept flow.
@Controller('admin/api/auth')
export class PasswordResetApiController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Post('forgot-password')
  async forgotPassword(
    @Body() body: ForgotPasswordBody,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    await this.passwordResetService.requestReset(body.email ?? '', {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });

    return { success: true };
  }

  @Get('password-reset/:token')
  getReset(@Param('token') token: string): Promise<PasswordResetSummary> {
    return this.passwordResetService.getReset(token);
  }

  @Post('password-reset/:token')
  async resetPassword(
    @Param('token') token: string,
    @Body() body: ResetPasswordBody,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    await this.passwordResetService.resetPassword(token, body.password ?? '', {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });

    return { success: true };
  }
}
