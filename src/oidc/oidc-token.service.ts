import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  createSign,
  createVerify,
  generateKeyPairSync,
  randomBytes,
} from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { monotonicFactory } from 'ulid';
import { AuditService } from '../audit/audit.service';
import { AppConfigService } from '../config/app-config.service';
import { AuditSeverity } from '../database/entities/audit-event.entity';
import { OidcAuthorizationCodeEntity } from '../database/entities/oidc-authorization-code.entity';
import {
  OidcClientEntity,
  OidcClientStatus,
  OidcClientType,
} from '../database/entities/oidc-client.entity';
import {
  SigningKeyEntity,
  SigningKeyStatus,
} from '../database/entities/signing-key.entity';
import { UserEntity, UserStatus } from '../database/entities/user.entity';
import { RefreshTokenService } from '../tokens/refresh-token.service';

const nextUlid = monotonicFactory();

export interface TokenRequestInput {
  grantType?: string;
  code?: string;
  redirectUri?: string;
  clientId?: string;
  clientSecret?: string;
  codeVerifier?: string;
  refreshToken?: string;
  ipAddress: string | null;
  userAgent: string | null;
  now?: Date;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  id_token?: string;
  refresh_token?: string;
  scope: string;
}

export interface UserInfoInput {
  authorizationHeader?: string;
}

export interface RevokeTokenInput {
  token?: string;
  now?: Date;
}

@Injectable()
export class OidcTokenService {
  private readonly issuer: string;
  private readonly signingSecret: string;

  constructor(
    configService: AppConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(SigningKeyEntity)
    private readonly signingKeyRepository: Repository<SigningKeyEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(OidcClientEntity)
    private readonly clientRepository: Repository<OidcClientEntity>,
    private readonly auditService: AuditService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {
    this.issuer = configService.get('app.baseUrl');
    this.signingSecret = configService.get('betterAuth.secret');
  }

  async jwks(): Promise<{ keys: Record<string, unknown>[] }> {
    const signingKey = await this.getOrCreateActiveSigningKey();

    return {
      keys: [signingKey.publicJwk],
    };
  }

  async exchangeAuthorizationCode(
    input: TokenRequestInput,
  ): Promise<TokenResponse> {
    if (input.grantType === 'refresh_token') {
      return this.refreshAccessToken(input);
    }

    if (input.grantType !== 'authorization_code') {
      throw new BadRequestException('Unsupported grant_type.');
    }

    const code = normalizeRequired(input.code, 'code');
    const redirectUri = normalizeRequired(input.redirectUri, 'redirect_uri');
    const clientIdentifier = normalizeRequired(input.clientId, 'client_id');
    const codeVerifier = normalizeRequired(input.codeVerifier, 'code_verifier');
    const now = input.now ?? new Date();

    return this.dataSource.transaction(async (manager) => {
      const codeRepository = manager.getRepository(OidcAuthorizationCodeEntity);
      const clientRepository = manager.getRepository(OidcClientEntity);
      const userRepository = manager.getRepository(UserEntity);

      const authorizationCode = await codeRepository.findOne({
        where: {
          codeHash: hashSecret(code),
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!authorizationCode) {
        throw new UnauthorizedException('Invalid authorization code.');
      }

      if (authorizationCode.consumedAt) {
        throw new UnauthorizedException('Authorization code already used.');
      }

      if (authorizationCode.expiresAt <= now) {
        throw new UnauthorizedException('Authorization code expired.');
      }

      if (authorizationCode.redirectUri !== redirectUri) {
        throw new UnauthorizedException('redirect_uri does not match code.');
      }

      const client = await clientRepository.findOne({
        where: {
          id: authorizationCode.clientId,
          clientId: clientIdentifier,
        },
      });

      if (!client || client.status !== OidcClientStatus.ACTIVE) {
        throw new UnauthorizedException('Invalid client.');
      }

      assertClientAuthentication(client, input.clientSecret);

      if (!verifyS256Pkce(codeVerifier, authorizationCode.codeChallenge)) {
        throw new UnauthorizedException('Invalid code_verifier.');
      }

      const user = await userRepository.findOne({
        where: {
          id: authorizationCode.userId,
        },
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Invalid user.');
      }

      authorizationCode.consumedAt = now;
      await codeRepository.save(authorizationCode);

      const signingKey = await this.getOrCreateActiveSigningKey();
      const scope = authorizationCode.scope;
      const issuedAtSeconds = Math.floor(now.getTime() / 1000);
      const accessTokenExpiresAt =
        issuedAtSeconds + client.accessTokenTtlSeconds;
      const idTokenExpiresAt = issuedAtSeconds + client.idTokenTtlSeconds;
      const commonClaims = {
        iss: this.issuer,
        aud: client.clientId,
        sub: user.id,
        iat: issuedAtSeconds,
      };
      const idToken = signJwt(
        {
          ...commonClaims,
          exp: idTokenExpiresAt,
          auth_time: Math.floor(authorizationCode.authTime.getTime() / 1000),
          ...(authorizationCode.nonce
            ? { nonce: authorizationCode.nonce }
            : {}),
          ...buildUserClaims(user, scope, client.allowedClaims),
        },
        signingKey,
        this.signingSecret,
      );
      const accessToken = signJwt(
        {
          ...commonClaims,
          exp: accessTokenExpiresAt,
          scope,
          token_use: 'access',
        },
        signingKey,
        this.signingSecret,
      );
      const refreshToken = shouldIssueRefreshToken(client, scope)
        ? await this.refreshTokenService.issueToken({
            userId: user.id,
            clientId: client.id,
            providerSessionId: authorizationCode.providerSessionId,
            idleTtlSeconds: client.refreshTokenIdleTtlSeconds,
            absoluteTtlSeconds: client.refreshTokenAbsoluteTtlSeconds,
            now,
          })
        : null;

      await this.auditService.record({
        eventType: 'oidc.token.issued',
        severity: AuditSeverity.INFO,
        actorUserId: user.id,
        targetUserId: user.id,
        clientId: client.id,
        providerSessionId: authorizationCode.providerSessionId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: {
          authorizationCodeId: authorizationCode.id,
          scope,
          tokenType: 'authorization_code',
        },
      });

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: client.accessTokenTtlSeconds,
        id_token: idToken,
        ...(refreshToken ? { refresh_token: refreshToken.refreshToken } : {}),
        scope,
      };
    });
  }

  async refreshAccessToken(input: TokenRequestInput): Promise<TokenResponse> {
    const refreshToken = normalizeRequired(input.refreshToken, 'refresh_token');
    const clientIdentifier = normalizeRequired(input.clientId, 'client_id');
    const now = input.now ?? new Date();
    const rotatedToken = await this.refreshTokenService.rotateTokenForClient({
      refreshToken,
      clientIdentifier,
      clientSecret: input.clientSecret,
      now,
    });
    const signingKey = await this.getOrCreateActiveSigningKey();
    const issuedAtSeconds = Math.floor(now.getTime() / 1000);
    const scope = 'openid offline_access';
    const accessToken = signJwt(
      {
        iss: this.issuer,
        aud: rotatedToken.client.clientId,
        sub: rotatedToken.token.userId,
        iat: issuedAtSeconds,
        exp: issuedAtSeconds + rotatedToken.client.accessTokenTtlSeconds,
        scope,
        token_use: 'access',
      },
      signingKey,
      this.signingSecret,
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: rotatedToken.client.accessTokenTtlSeconds,
      refresh_token: rotatedToken.refreshToken,
      scope,
    };
  }

  async revokeToken(input: RevokeTokenInput): Promise<void> {
    const token = normalizeRequired(input.token, 'token');

    await this.refreshTokenService.revokePresentedToken({
      refreshToken: token,
      reason: 'client_revocation',
      now: input.now,
    });
  }

  async userInfo(input: UserInfoInput): Promise<Record<string, unknown>> {
    const accessToken = extractBearerToken(input.authorizationHeader);

    if (!accessToken) {
      throw new UnauthorizedException('Bearer access token required.');
    }

    const payload = await this.verifyAccessToken(accessToken);
    const user = await this.userRepository.findOne({
      where: {
        id: String(payload.sub),
      },
    });
    const client = await this.clientRepository.findOne({
      where: {
        clientId: String(payload.aud),
        status: OidcClientStatus.ACTIVE,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE || !client) {
      throw new UnauthorizedException('Invalid access token.');
    }

    return {
      sub: user.id,
      ...buildUserClaims(user, String(payload.scope), client.allowedClaims),
    };
  }

  private async verifyAccessToken(
    token: string,
  ): Promise<Record<string, unknown>> {
    const signingKey = await this.getOrCreateActiveSigningKey();
    const payload = verifyJwt(token, signingKey.publicJwk);

    if (payload.iss !== this.issuer || payload.token_use !== 'access') {
      throw new UnauthorizedException('Invalid access token.');
    }

    return payload;
  }

  private async getOrCreateActiveSigningKey(): Promise<SigningKeyEntity> {
    const activeSigningKey = await this.signingKeyRepository.findOne({
      where: {
        status: SigningKeyStatus.ACTIVE,
      },
    });

    if (activeSigningKey) {
      return activeSigningKey;
    }

    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const kid = `kid_${nextUlid().toLowerCase()}`;
    const publicJwk = publicKey.export({ format: 'jwk' });
    const privateKeyPem = privateKey.export({
      type: 'pkcs8',
      format: 'pem',
    });
    const signingKey = this.signingKeyRepository.create({
      id: `sig_${nextUlid().toLowerCase()}`,
      kid,
      algorithm: 'RS256',
      publicJwk: {
        ...publicJwk,
        kid,
        alg: 'RS256',
        use: 'sig',
      },
      encryptedPrivateKey: encryptText(
        String(privateKeyPem),
        this.signingSecret,
      ),
      status: SigningKeyStatus.ACTIVE,
      activatedAt: new Date(),
      retiredAt: null,
    });

    return this.signingKeyRepository.save(signingKey);
  }
}

function normalizeRequired(
  value: string | undefined,
  fieldName: string,
): string {
  const normalizedValue = value?.trim() ?? '';

  if (normalizedValue.length === 0) {
    throw new BadRequestException(`${fieldName} is required.`);
  }

  return normalizedValue;
}

function assertClientAuthentication(
  client: OidcClientEntity,
  clientSecret: string | undefined,
): void {
  if (client.type === OidcClientType.PUBLIC) {
    return;
  }

  if (!client.clientSecretHash || !clientSecret) {
    throw new UnauthorizedException('Client authentication required.');
  }

  if (hashSecret(clientSecret) !== client.clientSecretHash) {
    throw new UnauthorizedException('Client authentication failed.');
  }
}

function shouldIssueRefreshToken(
  client: OidcClientEntity,
  scope: string,
): client is OidcClientEntity & {
  refreshTokenIdleTtlSeconds: number;
  refreshTokenAbsoluteTtlSeconds: number;
} {
  return (
    scope.split(' ').includes('offline_access') &&
    client.allowRefreshTokens &&
    client.refreshTokenIdleTtlSeconds !== null &&
    client.refreshTokenAbsoluteTtlSeconds !== null
  );
}

function verifyS256Pkce(verifier: string, challenge: string): boolean {
  return (
    createHash('sha256').update(verifier).digest('base64url') === challenge
  );
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function buildUserClaims(
  user: UserEntity,
  scope: string,
  allowedClaims: string[],
): Record<string, unknown> {
  const scopes = new Set(scope.split(' '));
  const claims: Record<string, unknown> = {};

  if (scopes.has('email') && allowedClaims.includes('email')) {
    claims.email = user.email;
    claims.email_verified = user.emailVerifiedAt !== null;
  }

  if (scopes.has('profile')) {
    if (allowedClaims.includes('name')) {
      claims.name = user.displayName;
    }

    if (allowedClaims.includes('given_name')) {
      claims.given_name = user.givenName;
    }

    if (allowedClaims.includes('family_name')) {
      claims.family_name = user.familyName;
    }

    if (allowedClaims.includes('preferred_username')) {
      claims.preferred_username = user.username;
    }

    if (allowedClaims.includes('profile_type')) {
      claims.profile_type = user.profileType;
    }
  }

  return claims;
}

function signJwt(
  payload: Record<string, unknown>,
  signingKey: SigningKeyEntity,
  secret: string,
): string {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: signingKey.kid,
  };
  const encodedHeader = base64UrlJson(header);
  const encodedPayload = base64UrlJson(payload);
  const signer = createSign('RSA-SHA256');
  signer.update(`${encodedHeader}.${encodedPayload}`);
  const signature = signer.sign(
    decryptText(signingKey.encryptedPrivateKey, secret),
    'base64url',
  );

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJwt(
  token: string,
  publicJwk: Record<string, unknown>,
): Record<string, unknown> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new UnauthorizedException('Invalid JWT.');
  }

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);

  if (
    !verifier.verify(
      createPublicKey({ key: publicJwk, format: 'jwk' }),
      encodedSignature,
      'base64url',
    )
  ) {
    throw new UnauthorizedException('Invalid JWT signature.');
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, 'base64url').toString('utf8'),
  ) as Record<string, unknown>;
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
    throw new UnauthorizedException('JWT expired.');
  }

  return payload;
}

function base64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function encryptText(value: string, secret: string): string {
  const iv = randomBytes(12);
  const key = createHash('sha256').update(secret).digest();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext]
    .map((buffer) => buffer.toString('base64url'))
    .join('.');
}

function decryptText(value: string, secret: string): string {
  const [ivPart, authTagPart, payloadPart] = value.split('.');

  if (!ivPart || !authTagPart || !payloadPart) {
    throw new UnauthorizedException('Invalid signing key.');
  }

  const key = createHash('sha256').update(secret).digest();
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivPart, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(payloadPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function extractBearerToken(
  authorizationHeader: string | undefined,
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ', 2);

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}
