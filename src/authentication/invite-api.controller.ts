import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  InviteAcceptService,
  type InviteSummary,
} from './invite-accept.service';

interface AcceptInviteBody {
  password?: string;
}

// Public JSON API consumed by the React accept-invite page. No CSRF cookie
// dance here (unlike login): the emailed token itself is the bearer secret
// that authorizes this request, the same trust model as a password-reset
// link — there's no ambient session/cookie for a forged cross-site request
// to ride along with.
@Controller('admin/api/invites')
export class InviteApiController {
  constructor(private readonly inviteAcceptService: InviteAcceptService) {}

  @Get(':token')
  getInvite(@Param('token') token: string): Promise<InviteSummary> {
    return this.inviteAcceptService.getInvite(token);
  }

  @Post(':token/accept')
  async accept(
    @Param('token') token: string,
    @Body() body: AcceptInviteBody,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    await this.inviteAcceptService.accept(token, body.password ?? '', {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });

    return { success: true };
  }
}
