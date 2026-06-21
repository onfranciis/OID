import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AdminPrincipal } from './admin-access.service';
import { AdminGuard } from './admin.guard';
import { AdminPageService } from './admin-page.service';

interface AdminRequest extends Request {
  adminPrincipal: AdminPrincipal;
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminPageService: AdminPageService) {}

  @Get()
  index(@Req() req: AdminRequest, @Res() res: Response): void {
    res.type('html').send(
      this.adminPageService.renderIndex({
        displayName: req.adminPrincipal.user.displayName,
      }),
    );
  }
}
