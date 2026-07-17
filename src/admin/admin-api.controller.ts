import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { OidcClientStatus } from '../database/entities/oidc-client.entity';
import { UserStatus } from '../database/entities/user.entity';
import type { AdminPrincipal } from './admin-access.service';
import {
  AdminAccountService,
  type AdminChangePasswordInput,
} from './admin-account.service';
import {
  AdminAuditService,
  type AdminAuditQueryInput,
} from './admin-audit.service';
import {
  AdminClientService,
  type AdminCreateClientInput,
  type AdminRedirectUriInput,
  type AdminUpdateClientInput,
} from './admin-client.service';
import { AdminCsrfGuard } from './admin-csrf.guard';
import { AdminCsrfService } from './admin-csrf.service';
import {
  AdminGroupService,
  type AdminCreateGroupInput,
  type AdminUpdateGroupInput,
} from './admin-group.service';
import { AdminGuard } from './admin.guard';
import { normalizeLimit } from './admin-pagination';
import {
  toAuditEvent,
  toClientDetail,
  toClientSummary,
  toGroupDetail,
  toGroupSummary,
  toUserDetail,
  toUserSummary,
} from './admin-presenters';
import { AdminRecentAuthGuard } from './admin-recent-auth.guard';
import {
  AdminUserService,
  type AdminCreateUserInput,
  type AdminUpdateUserInput,
} from './admin-user.service';

interface AdminRequest extends Request {
  adminPrincipal: AdminPrincipal;
}

// The hardened JSON API for the React admin app (FRONTEND_ROADMAP.md, backend
// queue item B-07). Read endpoints and mutations both live here under
// `/admin/api/*`; the SSR AdminController is retired in F6.
@Controller('admin/api')
@UseGuards(AdminGuard)
export class AdminApiController {
  private readonly adminGroupSlug: string;

  constructor(
    configService: AppConfigService,
    private readonly adminAccountService: AdminAccountService,
    private readonly adminAuditService: AdminAuditService,
    private readonly adminClientService: AdminClientService,
    private readonly adminCsrfService: AdminCsrfService,
    private readonly adminGroupService: AdminGroupService,
    private readonly adminUserService: AdminUserService,
  ) {
    this.adminGroupSlug = configService.get('bootstrap.adminGroupSlug');
  }

  @Get('session')
  getSession(
    @Req() req: AdminRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csrfToken = this.adminCsrfService.generateToken();
    res.setHeader(
      'set-cookie',
      this.adminCsrfService.buildCookieHeader(csrfToken),
    );

    const { user } = req.adminPrincipal;

    return {
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
      },
      isAdmin: true,
      csrfToken,
      adminGroupSlug: this.adminGroupSlug,
    };
  }

  // Account -----------------------------------------------------------------

  @Post('account/change-password')
  @UseGuards(AdminRecentAuthGuard, AdminCsrfGuard)
  async changePassword(
    @Req() req: AdminRequest,
    @Body() body: AdminChangePasswordInput,
  ): Promise<{ success: true }> {
    await this.adminAccountService.changePassword(
      {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        cookieHeader: req.headers.cookie,
      },
      buildMutationContext(req),
    );

    return { success: true };
  }

  // Users -------------------------------------------------------------------

  @Get('users')
  async listUsers(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: UserStatus,
    @Query('q') q?: string,
  ) {
    const page = await this.adminUserService.listUsers({
      cursor,
      limit: normalizeLimit(limit),
      status,
      q,
    });

    return {
      items: page.items.map(toUserSummary),
      nextCursor: page.nextCursor,
    };
  }

  @Get('users/:userId')
  async getUser(@Param('userId') userId: string) {
    return this.buildUserDetail(userId);
  }

  @Post('users')
  @UseGuards(AdminRecentAuthGuard, AdminCsrfGuard)
  async createUser(
    @Req() req: AdminRequest,
    @Body() body: AdminCreateUserInput,
  ) {
    const user = await this.adminUserService.createUser(
      body,
      buildMutationContext(req),
    );

    return this.buildUserDetail(user.id);
  }

  @Post('users/:userId')
  @UseGuards(AdminRecentAuthGuard, AdminCsrfGuard)
  async updateUser(
    @Req() req: AdminRequest,
    @Param('userId') userId: string,
    @Body() body: AdminUpdateUserInput,
  ) {
    await this.adminUserService.updateUser(
      userId,
      body,
      buildMutationContext(req),
    );

    return this.buildUserDetail(userId);
  }

  @Post('users/:userId/status')
  @UseGuards(AdminRecentAuthGuard, AdminCsrfGuard)
  async setUserStatus(
    @Req() req: AdminRequest,
    @Param('userId') userId: string,
    @Body('status') status: UserStatus,
  ) {
    await this.adminUserService.setUserStatus(
      userId,
      status,
      buildMutationContext(req),
    );

    return { user: await this.buildUserDetail(userId) };
  }

  // Groups ------------------------------------------------------------------

  @Get('groups')
  async listGroups(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    const page = await this.adminGroupService.listGroups({
      cursor,
      limit: normalizeLimit(limit),
      q,
    });

    return {
      items: page.items.map((entry) =>
        toGroupSummary(entry.group, entry.memberCount),
      ),
      nextCursor: page.nextCursor,
    };
  }

  @Get('groups/:groupId')
  async getGroup(@Param('groupId') groupId: string) {
    return this.buildGroupDetail(groupId);
  }

  @Post('groups')
  @UseGuards(AdminRecentAuthGuard, AdminCsrfGuard)
  async createGroup(
    @Req() req: AdminRequest,
    @Body() body: AdminCreateGroupInput,
  ) {
    const group = await this.adminGroupService.createGroup(
      body,
      buildMutationContext(req),
    );

    return this.buildGroupDetail(group.id);
  }

  @Post('groups/:groupId')
  @UseGuards(AdminRecentAuthGuard, AdminCsrfGuard)
  async updateGroup(
    @Req() req: AdminRequest,
    @Param('groupId') groupId: string,
    @Body() body: AdminUpdateGroupInput,
  ) {
    await this.adminGroupService.updateGroup(
      groupId,
      body,
      buildMutationContext(req),
    );

    return this.buildGroupDetail(groupId);
  }

  @Post('groups/:groupId/delete')
  @UseGuards(AdminRecentAuthGuard, AdminCsrfGuard)
  async deleteGroup(
    @Req() req: AdminRequest,
    @Param('groupId') groupId: string,
  ): Promise<{ id: string }> {
    await this.adminGroupService.deleteGroup(
      groupId,
      buildMutationContext(req),
    );

    return { id: groupId };
  }

  @Post('groups/:groupId/members/:userId')
  @UseGuards(AdminRecentAuthGuard, AdminCsrfGuard)
  async addGroupMembership(
    @Req() req: AdminRequest,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    await this.adminGroupService.addMembership(
      groupId,
      userId,
      buildMutationContext(req),
    );

    return this.buildGroupDetail(groupId);
  }

  @Post('groups/:groupId/members/:userId/remove')
  @UseGuards(AdminRecentAuthGuard, AdminCsrfGuard)
  async removeGroupMembership(
    @Req() req: AdminRequest,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    await this.adminGroupService.removeMembership(
      groupId,
      userId,
      buildMutationContext(req),
    );

    return this.buildGroupDetail(groupId);
  }

  // Clients -----------------------------------------------------------------

  @Get('clients')
  async listClients(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: OidcClientStatus,
    @Query('q') q?: string,
  ) {
    const page = await this.adminClientService.listClients({
      cursor,
      limit: normalizeLimit(limit),
      status,
      q,
    });

    return {
      items: page.items.map(toClientSummary),
      nextCursor: page.nextCursor,
    };
  }

  @Get('clients/:clientRecordId')
  async getClient(@Param('clientRecordId') clientRecordId: string) {
    return this.buildClientDetail(clientRecordId);
  }

  @Post('clients')
  @UseGuards(AdminRecentAuthGuard, AdminCsrfGuard)
  async createClient(
    @Req() req: AdminRequest,
    @Body() body: AdminCreateClientInput,
  ) {
    const client = await this.adminClientService.createClient(
      body,
      buildMutationContext(req),
    );

    return this.buildClientDetail(client.id);
  }

  @Post('clients/:clientRecordId')
  @UseGuards(AdminRecentAuthGuard, AdminCsrfGuard)
  async updateClient(
    @Req() req: AdminRequest,
    @Param('clientRecordId') clientRecordId: string,
    @Body() body: AdminUpdateClientInput,
  ) {
    await this.adminClientService.updateClient(
      clientRecordId,
      body,
      buildMutationContext(req),
    );

    return this.buildClientDetail(clientRecordId);
  }

  @Post('clients/:clientRecordId/status')
  @UseGuards(AdminRecentAuthGuard, AdminCsrfGuard)
  async setClientStatus(
    @Req() req: AdminRequest,
    @Param('clientRecordId') clientRecordId: string,
    @Body('status') status: OidcClientStatus,
  ) {
    await this.adminClientService.setClientStatus(
      clientRecordId,
      status,
      buildMutationContext(req),
    );

    return this.buildClientDetail(clientRecordId);
  }

  @Post('clients/:clientRecordId/secret/rotate')
  @UseGuards(AdminRecentAuthGuard, AdminCsrfGuard)
  rotateClientSecret(
    @Req() req: AdminRequest,
    @Param('clientRecordId') clientRecordId: string,
  ) {
    return this.adminClientService.rotateClientSecret(
      clientRecordId,
      buildMutationContext(req),
    );
  }

  @Post('clients/:clientRecordId/redirect-uris')
  @UseGuards(AdminRecentAuthGuard, AdminCsrfGuard)
  async addRedirectUri(
    @Req() req: AdminRequest,
    @Param('clientRecordId') clientRecordId: string,
    @Body() body: AdminRedirectUriInput,
  ) {
    const redirectUri = await this.adminClientService.addRedirectUri(
      clientRecordId,
      body,
      buildMutationContext(req),
    );

    return { id: redirectUri.id, uri: redirectUri.uri };
  }

  @Post('clients/:clientRecordId/redirect-uris/:redirectUriId/remove')
  @UseGuards(AdminRecentAuthGuard, AdminCsrfGuard)
  async removeRedirectUri(
    @Req() req: AdminRequest,
    @Param('clientRecordId') clientRecordId: string,
    @Param('redirectUriId') redirectUriId: string,
  ) {
    await this.adminClientService.removeRedirectUri(
      clientRecordId,
      redirectUriId,
      buildMutationContext(req),
    );

    return this.buildClientDetail(clientRecordId);
  }

  // Audit -------------------------------------------------------------------

  @Get('audit-events')
  async listAuditEvents(@Query() query: AdminAuditQueryInput) {
    const page = await this.adminAuditService.listRecent(query);

    return {
      items: page.items.map(toAuditEvent),
      nextCursor: page.nextCursor,
    };
  }

  // Composition helpers -----------------------------------------------------

  private async buildUserDetail(userId: string) {
    const user = await this.adminUserService.getUserById(userId);
    const groups = await this.adminGroupService.getGroupsForUser(userId);

    return toUserDetail(user, groups);
  }

  private async buildGroupDetail(groupId: string) {
    const group = await this.adminGroupService.getGroupById(groupId);
    const members = await this.adminGroupService.getGroupMembers(groupId);

    return toGroupDetail(group, members);
  }

  private async buildClientDetail(clientRecordId: string) {
    const client = await this.adminClientService.getClientById(clientRecordId);
    const redirectUris =
      await this.adminClientService.getRedirectUris(clientRecordId);

    return toClientDetail(client, redirectUris);
  }
}

function buildMutationContext(req: AdminRequest) {
  return {
    principal: req.adminPrincipal,
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  };
}
