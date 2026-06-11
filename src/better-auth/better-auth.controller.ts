import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BetterAuthService } from './better-auth.service';

@Controller('api/auth')
export class BetterAuthController {
  constructor(private readonly betterAuthService: BetterAuthService) {}

  @All()
  async handleRoot(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.betterAuthService.handle(req, res);
  }

  @All('*path')
  async handleNested(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.betterAuthService.handle(req, res);
  }
}
