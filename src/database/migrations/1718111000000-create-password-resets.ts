import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasswordResets1718111000000 implements MigrationInterface {
  name = 'CreatePasswordResets1718111000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "password_resets" (
        "id" text NOT NULL,
        "user_id" text NOT NULL,
        "token_hash" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMPTZ NOT NULL,
        "consumed_at" TIMESTAMPTZ,
        "revoked_at" TIMESTAMPTZ,
        CONSTRAINT "PK_password_resets_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_password_resets_token_hash" ON "password_resets" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_resets_expires_at" ON "password_resets" ("expires_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_resets" ADD CONSTRAINT "FK_password_resets_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "password_resets" DROP CONSTRAINT "FK_password_resets_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "password_resets"`);
  }
}
