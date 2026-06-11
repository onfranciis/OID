import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUpstreamRefreshTokenCiphertext1718108100000 implements MigrationInterface {
  name = 'AddUpstreamRefreshTokenCiphertext1718108100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD COLUMN "upstream_refresh_token_ciphertext" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      DROP COLUMN "upstream_refresh_token_ciphertext"
    `);
  }
}
