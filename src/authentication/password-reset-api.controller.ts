import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  PasswordResetService,
  type PasswordResetSummary,
} from './password-reset.service';
import { SensitiveActionRateLimitService } from './sensitive-action-rate-limit.service';

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
  constructor(
    private readonly passwordResetService: PasswordResetService,
    private readonly rateLimitService: SensitiveActionRateLimitService,
  ) {}

  @Post('forgot-password')
  async forgotPassword(
    @Body() body: ForgotPasswordBody,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    this.rateLimitService.assertAllowed(req.ip ?? null, body.email ?? null);
    await this.passwordResetService.requestReset(body.email ?? '', {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });

    return { success: true };
  }

  @Get('password-reset/:token')
  getReset(
    @Param('token') token: string,
    @Req() req: Request,
  ): Promise<PasswordResetSummary> {
    this.rateLimitService.assertAllowed(req.ip ?? null);
    return this.passwordResetService.getReset(token);
  }

  @Post('password-reset/:token')
  async resetPassword(
    @Param('token') token: string,
    @Body() body: ResetPasswordBody,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    this.rateLimitService.assertAllowed(req.ip ?? null);
    await this.passwordResetService.resetPassword(token, body.password ?? '', {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });

    return { success: true };
  }
}
