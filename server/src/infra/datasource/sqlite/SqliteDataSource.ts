import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { SqliteDialect, sql, type Dialect, type Kysely } from 'kysely';
import { SqlDataSource } from '../SqlDataSource.ts';
import type { Database } from '../sql/schema.ts';

export class SqliteDataSource extends SqlDataSource {
  readonly driver = 'sqlite';

  /** @param path caminho do arquivo, ou ':memory:' para testes. */
  constructor(private readonly path: string) {
    super();
  }

  protected createDialect(): Dialect {
    if (this.path !== ':memory:') mkdirSync(dirname(this.path), { recursive: true });
    return new SqliteDialect({ database: new BetterSqlite3(this.path) });
  }

  protected override async afterConnect(db: Kysely<Database>) {
    await sql`pragma foreign_keys = on`.execute(db);
    if (this.path !== ':memory:') await sql`pragma journal_mode = wal`.execute(db);
  }
}
