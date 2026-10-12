import type { MigrationInterface, QueryRunner } from 'typeorm';

const INDEXES: Array<{ name: string; table: string; columns: string }> = [
  { name: 'idx_refresh_tokens_user_id', table: 'refresh_tokens', columns: '"user_id"' },
  { name: 'idx_provider_sessions_user_id', table: 'provider_sessions', columns: '"user_id"' },
  { name: 'idx_authorization_codes_client_id', table: 'authorization_codes', columns: '"client_id"' },
  { name: 'idx_authorization_codes_user_id', table: 'authorization_codes', columns: '"user_id"' },
  {
    name: 'idx_authorization_codes_provider_session_id',
    table: 'authorization_codes',
    columns: '"provider_session_id"',
  },
  { name: 'idx_audit_events_actor_user_id', table: 'audit_events', columns: '"actor_user_id"' },
  { name: 'idx_audit_events_target_user_id', table: 'audit_events', columns: '"target_user_id"' },
  { name: 'idx_audit_events_client_id', table: 'audit_events', columns: '"client_id"' },
  { name: 'idx_group_memberships_group_id', table: 'group_memberships', columns: '"group_id"' },
];

export class AddHotLookupIndexes1718112000000 implements MigrationInterface {
  name = 'AddHotLookupIndexes1718112000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const index of INDEXES) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "${index.name}" ON "${index.table}" (${index.columns})`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const index of [...INDEXES].reverse()) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${index.name}"`);
    }
  }
}
