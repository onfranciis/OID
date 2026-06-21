import { Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { OidcAuthorizationService } from './oidc-authorization.service';
import { OidcTokenService } from './oidc-token.service';

interface AuthorizeQuery {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  nonce?: string;
  prompt?: string;
}

interface TokenBody {
  grant_type?: string;
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  client_secret?: string;
  code_verifier?: string;
  refresh_token?: string;
}

interface RevokeBody {
  token?: string;
}

@Controller()
export class OidcController {
  private readonly issuer: string;
  private readonly providerSessionCookieName: string;

  constructor(
    configService: ConfigService,
    private readonly authorizationService: OidcAuthorizationService,
    private readonly tokenService: OidcTokenService,
  ) {
    this.issuer = configService.getOrThrow<string>('app.baseUrl');
    this.providerSessionCookieName = configService.getOrThrow<string>(
      'authentication.providerSessionCookieName',
    );
  }

  @Get('.well-known/openid-configuration')
  discovery() {
    return {
      issuer: this.issuer,
      authorization_endpoint: `${this.issuer}/oauth/authorize`,
      token_endpoint: `${this.issuer}/oauth/token`,
      revocation_endpoint: `${this.issuer}/oauth/revoke`,
      jwks_uri: `${this.issuer}/.well-known/jwks.json`,
      userinfo_endpoint: `${this.issuer}/oauth/userinfo`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: [
        'openid',
        'profile',
        'email',
        'groups',
        'offline_access',
      ],
      claims_supported: [
        'sub',
        'iss',
        'aud',
        'exp',
        'iat',
        'auth_time',
        'nonce',
        'email',
        'email_verified',
        'name',
        'given_name',
        'family_name',
        'preferred_username',
        'groups',
        'profile_type',
      ],
      code_challenge_methods_supported: ['S256'],
    };
  }

  @Get('.well-known/jwks.json')
  jwks() {
    return this.tokenService.jwks();
  }

  @Get('oauth/authorize')
  async authorize(
    @Query() query: AuthorizeQuery,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.authorizationService.authorize({
      responseType: query.response_type,
      clientId: query.client_id,
      redirectUri: query.redirect_uri,
      scope: query.scope,
      state: query.state,
      codeChallenge: query.code_challenge,
      codeChallengeMethod: query.code_challenge_method,
      nonce: query.nonce,
      prompt: query.prompt,
      providerSessionToken:
        parseCookies(req.headers.cookie)[this.providerSessionCookieName] ??
        null,
      originalUrl: req.originalUrl,
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });

    res.redirect(result.redirectTo);
  }

  @Post('oauth/token')
  token(@Body() body: TokenBody, @Req() req: Request) {
    return this.tokenService.exchangeAuthorizationCode({
      grantType: body.grant_type,
      code: body.code,
      redirectUri: body.redirect_uri,
      clientId: body.client_id,
      clientSecret: body.client_secret,
      codeVerifier: body.code_verifier,
      refreshToken: body.refresh_token,
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
  }

  @Get('oauth/userinfo')
  userInfo(@Req() req: Request) {
    return this.tokenService.userInfo({
      authorizationHeader: req.get('authorization') ?? undefined,
    });
  }

  @Post('oauth/revoke')
  async revoke(@Body() body: RevokeBody): Promise<void> {
    await this.tokenService.revokeToken({
      token: body.token,
    });
  }
}

function parseCookies(headerValue: string | undefined): Record<string, string> {
  if (!headerValue) {
    return {};
  }

  return Object.fromEntries(
    headerValue
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => {
        const separatorIndex = part.indexOf('=');

        if (separatorIndex === -1) {
          return [part, ''];
        }

        return [
          part.slice(0, separatorIndex),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ];
      }),
  );
}
