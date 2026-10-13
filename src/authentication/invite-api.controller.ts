import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  InviteAcceptService,
  type InviteSummary,
} from './invite-accept.service';
import { SensitiveActionRateLimitService } from './sensitive-action-rate-limit.service';

interface AcceptInviteBody {
  password?: string;
}

// No CSRF cookie here (unlike login): the emailed token is itself the bearer
// secret, same trust model as a password-reset link.
@Controller('admin/api/invites')
export class InviteApiController {
  constructor(
    private readonly inviteAcceptService: InviteAcceptService,
    private readonly rateLimitService: SensitiveActionRateLimitService,
  ) {}

  @Get(':token')
  getInvite(
    @Param('token') token: string,
    @Req() req: Request,
  ): Promise<InviteSummary> {
    this.rateLimitService.assertAllowed(req.ip ?? null);
    return this.inviteAcceptService.getInvite(token);
  }

  @Post(':token/accept')
  async accept(
    @Param('token') token: string,
    @Body() body: AcceptInviteBody,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    this.rateLimitService.assertAllowed(req.ip ?? null);
    await this.inviteAcceptService.accept(token, body.password ?? '', {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });

    return { success: true };
  }
}
