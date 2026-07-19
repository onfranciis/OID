import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserInvites1718110000000 implements MigrationInterface {
  name = 'CreateUserInvites1718110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_invites" (
        "id" text NOT NULL,
        "user_id" text NOT NULL,
        "token_hash" text NOT NULL,
        "invited_by_user_id" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMPTZ NOT NULL,
        "consumed_at" TIMESTAMPTZ,
        "revoked_at" TIMESTAMPTZ,
        CONSTRAINT "PK_user_invites_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_invites_token_hash" ON "user_invites" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_invites_expires_at" ON "user_invites" ("expires_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_invites" ADD CONSTRAINT "FK_user_invites_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_invites" ADD CONSTRAINT "FK_user_invites_invited_by_user_id" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_invites" DROP CONSTRAINT "FK_user_invites_invited_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_invites" DROP CONSTRAINT "FK_user_invites_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "user_invites"`);
  }
}
