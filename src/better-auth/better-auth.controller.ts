import { All, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BetterAuthService } from './better-auth.service';
import {
  assertSupportedAuthorizationRequest,
  assertSupportedTokenRequest,
  blockDynamicClientRegistration,
} from './better-auth.guardrails';

@Controller('api/auth')
export class BetterAuthController {
  constructor(private readonly betterAuthService: BetterAuthService) {}

  @Get('oauth2/authorize')
  async authorize(@Req() req: Request, @Res() res: Response): Promise<void> {
    assertSupportedAuthorizationRequest(req.query);
    await this.betterAuthService.handle(req, res);
  }

  @Post('oauth2/token')
  async token(@Req() req: Request, @Res() res: Response): Promise<void> {
    assertSupportedTokenRequest(req.body);
    await this.betterAuthService.handle(req, res);
  }

  @All('oauth2/register')
  blockRegister(): never {
    return blockDynamicClientRegistration();
  }

  @All()
  async handleRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.betterAuthService.handle(req, res);
  }

  @All('*path')
  async handleNested(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.betterAuthService.handle(req, res);
  }
}
