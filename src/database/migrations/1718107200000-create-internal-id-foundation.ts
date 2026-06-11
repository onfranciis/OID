import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInternalIdFoundation1718107200000 implements MigrationInterface {
  name = 'CreateInternalIdFoundation1718107200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_profile_type_enum" AS ENUM('employee', 'contractor', 'service')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('pending', 'active', 'suspended', 'deactivated')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."oidc_clients_type_enum" AS ENUM('confidential', 'public')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."oidc_clients_status_enum" AS ENUM('active', 'disabled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."authorization_codes_code_challenge_method_enum" AS ENUM('S256')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."signing_keys_status_enum" AS ENUM('pending', 'active', 'retiring', 'retired', 'compromised')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_events_severity_enum" AS ENUM('info', 'warning', 'critical')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" text NOT NULL,
        "email" text NOT NULL,
        "normalized_email" text NOT NULL,
        "email_verified_at" TIMESTAMPTZ,
        "username" text,
        "normalized_username" text,
        "display_name" text NOT NULL,
        "given_name" text,
        "family_name" text,
        "profile_type" "public"."users_profile_type_enum" NOT NULL DEFAULT 'employee',
        "status" "public"."users_status_enum" NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deactivated_at" TIMESTAMPTZ,
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_normalized_email" ON "users" ("normalized_email")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_normalized_username" ON "users" ("normalized_username") WHERE "normalized_username" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "groups" (
        "id" text NOT NULL,
        "slug" text NOT NULL,
        "display_name" text NOT NULL,
        "description" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_groups_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_groups_slug" ON "groups" ("slug")`,
    );

    await queryRunner.query(`
      CREATE TABLE "oidc_clients" (
        "id" text NOT NULL,
        "client_id" text NOT NULL,
        "client_secret_hash" text,
        "name" text NOT NULL,
        "type" "public"."oidc_clients_type_enum" NOT NULL,
        "status" "public"."oidc_clients_status_enum" NOT NULL,
        "allowed_scopes" text[] NOT NULL DEFAULT '{}',
        "allowed_claims" text[] NOT NULL DEFAULT '{}',
        "require_pkce" boolean NOT NULL DEFAULT true,
        "allow_refresh_tokens" boolean NOT NULL DEFAULT false,
        "access_token_ttl_seconds" integer NOT NULL DEFAULT 900,
        "id_token_ttl_seconds" integer NOT NULL DEFAULT 900,
        "refresh_token_idle_ttl_seconds" integer,
        "refresh_token_absolute_ttl_seconds" integer,
        "owner_team" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_oidc_clients_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_oidc_clients_client_id" ON "oidc_clients" ("client_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "signing_keys" (
        "id" text NOT NULL,
        "kid" text NOT NULL,
        "algorithm" text NOT NULL,
        "public_jwk" jsonb NOT NULL,
        "encrypted_private_key" text NOT NULL,
        "status" "public"."signing_keys_status_enum" NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "activated_at" TIMESTAMPTZ,
        "retired_at" TIMESTAMPTZ,
        CONSTRAINT "PK_signing_keys_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_signing_keys_kid" ON "signing_keys" ("kid")`,
    );

    await queryRunner.query(`
      CREATE TABLE "group_memberships" (
        "user_id" text NOT NULL,
        "group_id" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_by" text,
        CONSTRAINT "PK_group_memberships_user_group" PRIMARY KEY ("user_id", "group_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "oidc_redirect_uris" (
        "id" text NOT NULL,
        "client_id" text NOT NULL,
        "uri" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_oidc_redirect_uris_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_oidc_redirect_uris_client_uri" UNIQUE ("client_id", "uri")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "oidc_post_logout_redirect_uris" (
        "id" text NOT NULL,
        "client_id" text NOT NULL,
        "uri" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_oidc_post_logout_redirect_uris_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_oidc_post_logout_redirect_uris_client_uri" UNIQUE ("client_id", "uri")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "provider_sessions" (
        "id" text NOT NULL,
        "user_id" text NOT NULL,
        "session_hash" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "last_seen_at" TIMESTAMPTZ NOT NULL,
        "auth_time" TIMESTAMPTZ NOT NULL,
        "idle_expires_at" TIMESTAMPTZ NOT NULL,
        "absolute_expires_at" TIMESTAMPTZ NOT NULL,
        "revoked_at" TIMESTAMPTZ,
        "revocation_reason" text,
        "ip_address" text,
        "user_agent" text,
        CONSTRAINT "PK_provider_sessions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_provider_sessions_session_hash" ON "provider_sessions" ("session_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_provider_sessions_idle_expires_at" ON "provider_sessions" ("idle_expires_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_provider_sessions_absolute_expires_at" ON "provider_sessions" ("absolute_expires_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "authorization_codes" (
        "id" text NOT NULL,
        "code_hash" text NOT NULL,
        "client_id" text NOT NULL,
        "user_id" text NOT NULL,
        "provider_session_id" text NOT NULL,
        "redirect_uri" text NOT NULL,
        "scope" text NOT NULL,
        "code_challenge" text NOT NULL,
        "code_challenge_method" "public"."authorization_codes_code_challenge_method_enum" NOT NULL,
        "nonce" text,
        "auth_time" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMPTZ NOT NULL,
        "consumed_at" TIMESTAMPTZ,
        CONSTRAINT "PK_authorization_codes_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_authorization_codes_code_hash" ON "authorization_codes" ("code_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_authorization_codes_expires_at" ON "authorization_codes" ("expires_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_authorization_codes_consumed_at" ON "authorization_codes" ("consumed_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" text NOT NULL,
        "token_hash" text NOT NULL,
        "user_id" text NOT NULL,
        "client_id" text NOT NULL,
        "provider_session_id" text,
        "parent_token_id" text,
        "rotated_to_token_id" text,
        "family_id" text NOT NULL,
        "issued_at" TIMESTAMPTZ NOT NULL,
        "last_used_at" TIMESTAMPTZ,
        "idle_expires_at" TIMESTAMPTZ NOT NULL,
        "absolute_expires_at" TIMESTAMPTZ NOT NULL,
        "revoked_at" TIMESTAMPTZ,
        "revocation_reason" text,
        CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_family_id" ON "refresh_tokens" ("family_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_idle_expires_at" ON "refresh_tokens" ("idle_expires_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_absolute_expires_at" ON "refresh_tokens" ("absolute_expires_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "audit_events" (
        "id" text NOT NULL,
        "event_type" text NOT NULL,
        "severity" "public"."audit_events_severity_enum" NOT NULL,
        "actor_user_id" text,
        "target_user_id" text,
        "client_id" text,
        "provider_session_id" text,
        "ip_address" text,
        "user_agent" text,
        "metadata_json" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_events_created_at" ON "audit_events" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_events_event_type" ON "audit_events" ("event_type")`,
    );

    await queryRunner.query(
      `ALTER TABLE "group_memberships" ADD CONSTRAINT "FK_group_memberships_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_memberships" ADD CONSTRAINT "FK_group_memberships_group_id" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_memberships" ADD CONSTRAINT "FK_group_memberships_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "oidc_redirect_uris" ADD CONSTRAINT "FK_oidc_redirect_uris_client_id" FOREIGN KEY ("client_id") REFERENCES "oidc_clients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "oidc_post_logout_redirect_uris" ADD CONSTRAINT "FK_oidc_post_logout_redirect_uris_client_id" FOREIGN KEY ("client_id") REFERENCES "oidc_clients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_sessions" ADD CONSTRAINT "FK_provider_sessions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "authorization_codes" ADD CONSTRAINT "FK_authorization_codes_client_id" FOREIGN KEY ("client_id") REFERENCES "oidc_clients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "authorization_codes" ADD CONSTRAINT "FK_authorization_codes_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "authorization_codes" ADD CONSTRAINT "FK_authorization_codes_provider_session_id" FOREIGN KEY ("provider_session_id") REFERENCES "provider_sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_client_id" FOREIGN KEY ("client_id") REFERENCES "oidc_clients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_provider_session_id" FOREIGN KEY ("provider_session_id") REFERENCES "provider_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_parent_token_id" FOREIGN KEY ("parent_token_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_rotated_to_token_id" FOREIGN KEY ("rotated_to_token_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "FK_audit_events_actor_user_id" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "FK_audit_events_target_user_id" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "FK_audit_events_client_id" FOREIGN KEY ("client_id") REFERENCES "oidc_clients"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" ADD CONSTRAINT "FK_audit_events_provider_session_id" FOREIGN KEY ("provider_session_id") REFERENCES "provider_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "FK_audit_events_provider_session_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "FK_audit_events_client_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "FK_audit_events_target_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_events" DROP CONSTRAINT "FK_audit_events_actor_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_refresh_tokens_rotated_to_token_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_refresh_tokens_parent_token_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_refresh_tokens_provider_session_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_refresh_tokens_client_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_refresh_tokens_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "authorization_codes" DROP CONSTRAINT "FK_authorization_codes_provider_session_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "authorization_codes" DROP CONSTRAINT "FK_authorization_codes_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "authorization_codes" DROP CONSTRAINT "FK_authorization_codes_client_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "provider_sessions" DROP CONSTRAINT "FK_provider_sessions_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "oidc_post_logout_redirect_uris" DROP CONSTRAINT "FK_oidc_post_logout_redirect_uris_client_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "oidc_redirect_uris" DROP CONSTRAINT "FK_oidc_redirect_uris_client_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_memberships" DROP CONSTRAINT "FK_group_memberships_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_memberships" DROP CONSTRAINT "FK_group_memberships_group_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "group_memberships" DROP CONSTRAINT "FK_group_memberships_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_audit_events_event_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_audit_events_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "audit_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_refresh_tokens_absolute_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_refresh_tokens_idle_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_refresh_tokens_family_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_refresh_tokens_token_hash"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_authorization_codes_consumed_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_authorization_codes_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_authorization_codes_code_hash"`,
    );
    await queryRunner.query(`DROP TABLE "authorization_codes"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_provider_sessions_absolute_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_provider_sessions_idle_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_provider_sessions_session_hash"`,
    );
    await queryRunner.query(`DROP TABLE "provider_sessions"`);
    await queryRunner.query(`DROP TABLE "oidc_post_logout_redirect_uris"`);
    await queryRunner.query(`DROP TABLE "oidc_redirect_uris"`);
    await queryRunner.query(`DROP TABLE "group_memberships"`);
    await queryRunner.query(`DROP INDEX "public"."uq_signing_keys_kid"`);
    await queryRunner.query(`DROP TABLE "signing_keys"`);
    await queryRunner.query(`DROP INDEX "public"."uq_oidc_clients_client_id"`);
    await queryRunner.query(`DROP TABLE "oidc_clients"`);
    await queryRunner.query(`DROP INDEX "public"."uq_groups_slug"`);
    await queryRunner.query(`DROP TABLE "groups"`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_users_normalized_username"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_users_normalized_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."audit_events_severity_enum"`);
    await queryRunner.query(`DROP TYPE "public"."signing_keys_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."authorization_codes_code_challenge_method_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."oidc_clients_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."oidc_clients_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_profile_type_enum"`);
  }
}
