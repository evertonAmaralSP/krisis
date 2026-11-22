/**
 * Migrations portáveis entre dialetos SQL. Só tipos e recursos comuns a
 * SQLite e Postgres: text, integer, real, chaves estrangeiras e índices.
 * Nunca altere uma migration já aplicada: crie a próxima.
 */
import type { Kysely } from 'kysely';
import type { Migration, MigrationProvider } from 'kysely/migration';

const m001_inicial: Migration = {
  async up(db: Kysely<any>) {
    await db.schema
      .createTable('users')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('name', 'text', (c) => c.notNull())
      .addColumn('email', 'text', (c) => c.notNull().unique())
      .addColumn('password_hash', 'text', (c) => c.notNull())
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addColumn('updated_at', 'text', (c) => c.notNull())
      .execute();

    await db.schema
      .createTable('sessions')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('user_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
      .addColumn('expires_at', 'text', (c) => c.notNull())
      .addColumn('created_at', 'text', (c) => c.notNull())
      .execute();
    await db.schema.createIndex('sessions_user_id_idx').on('sessions').column('user_id').execute();

    await db.schema
      .createTable('interviews')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('user_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
      .addColumn('role', 'text', (c) => c.notNull())
      .addColumn('company', 'text', (c) => c.notNull())
      .addColumn('level', 'text', (c) => c.notNull())
      .addColumn('kind', 'text', (c) => c.notNull())
      .addColumn('job_description', 'text')
      .addColumn('resume', 'text')
      .addColumn('stt_engine', 'text')
      .addColumn('llm_engine', 'text', (c) => c.notNull())
      .addColumn('tts_engine', 'text')
      .addColumn('status', 'text', (c) => c.notNull())
      .addColumn('created_at', 'text', (c) => c.notNull())
      .addColumn('finished_at', 'text')
      .execute();
    await db.schema
      .createIndex('interviews_user_created_idx')
      .on('interviews')
      .columns(['user_id', 'created_at'])
      .execute();

    await db.schema
      .createTable('messages')
      .addColumn('id', 'text', (c) => c.primaryKey())
      .addColumn('interview_id', 'text', (c) =>
        c.notNull().references('interviews.id').onDelete('cascade'),
      )
      .addColumn('seq', 'integer', (c) => c.notNull())
      .addColumn('author', 'text', (c) => c.notNull())
      .addColumn('content', 'text', (c) => c.notNull())
      .addColumn('input_mode', 'text')
      .addColumn('audio_seconds', 'real')
      .addColumn('stt_ms', 'integer')
      .addColumn('llm_ms', 'integer')
      .addColumn('tts_ms', 'integer')
      .addColumn('created_at', 'text', (c) => c.notNull())
      .execute();
    await db.schema
      .createIndex('messages_interview_seq_idx')
      .on('messages')
      .columns(['interview_id', 'seq'])
      .unique()
      .execute();
  },
  async down(db: Kysely<any>) {
    await db.schema.dropTable('messages').execute();
    await db.schema.dropTable('interviews').execute();
    await db.schema.dropTable('sessions').execute();
    await db.schema.dropTable('users').execute();
  },
};

const m002_voz_preferida: Migration = {
  async up(db: Kysely<any>) {
    await db.schema.alterTable('users').addColumn('tts_voice', 'text').execute();
  },
  async down(db: Kysely<any>) {
    await db.schema.alterTable('users').dropColumn('tts_voice').execute();
  },
};

/** Migrations embutidas no código: funcionam igual em servidor e em função serverless. */
export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return {
      '001_inicial': m001_inicial,
      '002_voz_preferida': m002_voz_preferida,
    };
  },
};
