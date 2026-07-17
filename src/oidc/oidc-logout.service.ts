import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticationRequestContext } from '../authentication/authentication.service';
import { AuthenticationService } from '../authentication/authentication.service';
import { AuditService } from '../audit/audit.service';
import { AuditEventTypes } from '../audit/audit.types';
import { AppConfigService } from '../config/app-config.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { OidcClientEntity } from '../database/entities/oidc-client.entity';
import { OidcPostLogoutRedirectUriEntity } from '../database/entities/oidc-post-logout-redirect-uri.entity';
import { OidcTokenService } from './oidc-token.service';

export interface EndSessionInput extends AuthenticationRequestContext {
  idTokenHint?: string;
  clientId?: string;
  postLogoutRedirectUri?: string;
  state?: string;
}

export interface EndSessionResult {
  redirectTo: string;
  responseHeaders: string[];
}

// OIDC RP-Initiated Logout 1.0: terminates the caller's provider session (the
// same work POST /logout does) and, only when the caller's identity can be
// established, redirects back to a post_logout_redirect_uri registered for
// that client. An untrusted or unregistered redirect target is silently
// ignored in favor of the provider's own login page — never followed.
@Injectable()
export class OidcLogoutService {
  private readonly defaultRedirect: string;

  constructor(
    configService: AppConfigService,
    @InjectRepository(OidcClientEntity)
    private readonly clientRepository: Repository<OidcClientEntity>,
    @InjectRepository(OidcPostLogoutRedirectUriEntity)
    private readonly postLogoutRedirectUriRepository: Repository<OidcPostLogoutRedirectUriEntity>,
    private readonly tokenService: OidcTokenService,
    private readonly authenticationService: AuthenticationService,
    private readonly auditService: AuditService,
  ) {
    this.defaultRedirect = configService.get('betterAuth.loginPath');
  }

  async endSession(input: EndSessionInput): Promise<EndSessionResult> {
    const hint = input.idTokenHint
      ? await this.tokenService.verifyIdTokenHint(input.idTokenHint)
      : null;
    const clientIdentifier =
      normalizeOptional(input.clientId) ?? hint?.aud ?? null;

    const redirectTo = await this.resolveRedirectTo(
      clientIdentifier,
      normalizeOptional(input.postLogoutRedirectUri),
      normalizeOptional(input.state),
    );

    const logoutResult = await this.authenticationService.logout(input);

    await this.auditService.record({
      eventType: AuditEventTypes.OidcEndSessionSucceeded,
      severity: AuditSeverity.INFO,
      targetUserId: hint?.sub ?? null,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: {
        clientIdentifier,
        hadIdTokenHint: Boolean(input.idTokenHint),
        redirectTo,
      },
    });

    return {
      redirectTo,
      responseHeaders: logoutResult.responseHeaders,
    };
  }

  private async resolveRedirectTo(
    clientIdentifier: string | null,
    postLogoutRedirectUri: string | null,
    state: string | null,
  ): Promise<string> {
    if (!postLogoutRedirectUri || !clientIdentifier) {
      return this.defaultRedirect;
    }

    const client = await this.clientRepository.findOne({
      where: {
        clientId: clientIdentifier,
      },
    });

    if (!client) {
      return this.defaultRedirect;
    }

    const registered = await this.postLogoutRedirectUriRepository.findOne({
      where: {
        clientId: client.id,
        uri: postLogoutRedirectUri,
      },
    });

    if (!registered) {
      return this.defaultRedirect;
    }

    if (!state) {
      return postLogoutRedirectUri;
    }

    const url = new URL(postLogoutRedirectUri);
    url.searchParams.set('state', state);

    return url.toString();
  }
}

function normalizeOptional(value: string | undefined): string | null {
  const normalized = value?.trim() ?? '';

  return normalized.length > 0 ? normalized : null;
}
