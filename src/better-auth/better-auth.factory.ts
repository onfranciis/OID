import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { jwt } from 'better-auth/plugins/jwt';
import { oidcProvider } from 'better-auth/plugins/oidc-provider';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { AuditEventRecordInput } from '../audit/audit.types';
import type { AppEnvironment } from '../config/app-environment';
import { getAdditionalUserInfoClaims } from './claim-policy';
import { createInternalAuditPlugin } from './internal-audit.plugin';

export interface BetterAuthMountable {
  api: Record<string, unknown>;
  handler: (request: Request) => Promise<Response>;
  options: BetterAuthOptions;
}

export interface BetterAuthRuntime {
  auth: BetterAuthMountable;
  pool: Pool;
  db: Kysely<unknown>;
}

export interface BetterAuthRuntimeOptions {
  recordAuditEvent?: (input: AuditEventRecordInput) => Promise<string>;
}

export function createBetterAuthRuntime(
  appEnvironment: AppEnvironment,
  options?: BetterAuthRuntimeOptions,
): BetterAuthRuntime {
  const pool = new Pool({
    connectionString: appEnvironment.database.url,
  });

  const db = new Kysely<unknown>({
    dialect: new PostgresDialect({
      pool,
    }),
  });

  const auth = betterAuth({
    database: {
      db,
      type: 'postgres',
    },
    baseURL: appEnvironment.app.baseUrl,
    basePath: appEnvironment.betterAuth.basePath,
    secret: appEnvironment.betterAuth.secret,
    trustedOrigins: [appEnvironment.app.baseUrl],
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      jwt({
        disableSettingJwtHeader: true,
        jwks: {
          jwksPath: '/.well-known/jwks.json',
          keyPairConfig: {
            alg: 'RS256',
            modulusLength: 2048,
          },
        },
        jwt: {
          issuer: appEnvironment.app.baseUrl,
          audience: appEnvironment.app.baseUrl,
          expirationTime: '15m',
        },
      }),
      oidcProvider({
        __skipDeprecationWarning: true,
        loginPage: appEnvironment.betterAuth.loginPath,
        allowDynamicClientRegistration: false,
        requirePKCE: true,
        allowPlainCodeChallengeMethod: false,
        useJWTPlugin: true,
        defaultScope: 'openid',
        scopes: ['openid', 'profile', 'email', 'groups', 'offline_access'],
        accessTokenExpiresIn: 900,
        refreshTokenExpiresIn: 604800,
        codeExpiresIn: 600,
        getAdditionalUserInfoClaim: async (user, scopes, client) =>
          getAdditionalUserInfoClaims(db, user, scopes, client),
        metadata: {
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'],
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
        },
      }),
      ...(options?.recordAuditEvent
        ? [
            createInternalAuditPlugin({
              recordAuditEvent: options.recordAuditEvent,
            }),
          ]
        : []),
    ],
  });

  return {
    auth,
    pool,
    db,
  };
}
