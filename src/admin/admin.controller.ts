import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AdminPrincipal } from './admin-access.service';
import {
  AdminGroupService,
  type AdminCreateGroupInput,
  type AdminUpdateGroupInput,
} from './admin-group.service';
import { AdminGuard } from './admin.guard';
import { AdminPageService } from './admin-page.service';
import {
  AdminUserService,
  type AdminCreateUserInput,
  type AdminUpdateUserInput,
} from './admin-user.service';
import { UserStatus } from '../database/entities/user.entity';

interface AdminRequest extends Request {
  adminPrincipal: AdminPrincipal;
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly adminPageService: AdminPageService,
    private readonly adminGroupService: AdminGroupService,
    private readonly adminUserService: AdminUserService,
  ) {}

  @Get()
  index(@Req() req: AdminRequest, @Res() res: Response): void {
    res.type('html').send(
      this.adminPageService.renderIndex({
        displayName: req.adminPrincipal.user.displayName,
      }),
    );
  }

  @Post('users')
  createUser(@Req() req: AdminRequest, @Body() body: AdminCreateUserInput) {
    return this.adminUserService.createUser(body, buildMutationContext(req));
  }

  @Post('users/:userId')
  updateUser(
    @Req() req: AdminRequest,
    @Param('userId') userId: string,
    @Body() body: AdminUpdateUserInput,
  ) {
    return this.adminUserService.updateUser(
      userId,
      body,
      buildMutationContext(req),
    );
  }

  @Post('users/:userId/status')
  setUserStatus(
    @Req() req: AdminRequest,
    @Param('userId') userId: string,
    @Body('status') status: UserStatus,
  ) {
    return this.adminUserService.setUserStatus(
      userId,
      status,
      buildMutationContext(req),
    );
  }

  @Post('groups')
  createGroup(@Req() req: AdminRequest, @Body() body: AdminCreateGroupInput) {
    return this.adminGroupService.createGroup(body, buildMutationContext(req));
  }

  @Post('groups/:groupId')
  updateGroup(
    @Req() req: AdminRequest,
    @Param('groupId') groupId: string,
    @Body() body: AdminUpdateGroupInput,
  ) {
    return this.adminGroupService.updateGroup(
      groupId,
      body,
      buildMutationContext(req),
    );
  }

  @Post('groups/:groupId/members/:userId')
  addGroupMembership(
    @Req() req: AdminRequest,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    return this.adminGroupService.addMembership(
      groupId,
      userId,
      buildMutationContext(req),
    );
  }

  @Post('groups/:groupId/members/:userId/remove')
  removeGroupMembership(
    @Req() req: AdminRequest,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    return this.adminGroupService.removeMembership(
      groupId,
      userId,
      buildMutationContext(req),
    );
  }
}

function buildMutationContext(req: AdminRequest) {
  return {
    principal: req.adminPrincipal,
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  };
}
