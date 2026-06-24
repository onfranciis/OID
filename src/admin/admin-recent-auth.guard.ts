import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';
import type { AdminPrincipal } from './admin-access.service';

interface AdminRequest extends Request {
  adminPrincipal?: AdminPrincipal;
}

@Injectable()
export class AdminRecentAuthGuard implements CanActivate {
  private readonly recentAuthWindowSeconds: number;

  constructor(configService: AppConfigService) {
    this.recentAuthWindowSeconds = configService.get(
      'authentication.adminRecentAuthWindowSeconds',
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const authTime = request.adminPrincipal?.providerSession.authTime;

    if (!authTime) {
      throw new ForbiddenException('Recent admin authentication required.');
    }

    const authAgeMilliseconds = Date.now() - authTime.getTime();
    const allowedAgeMilliseconds = this.recentAuthWindowSeconds * 1000;

    if (authAgeMilliseconds > allowedAgeMilliseconds) {
      throw new ForbiddenException('Recent admin authentication required.');
    }

    return true;
  }
}
