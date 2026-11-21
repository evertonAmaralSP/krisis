import type { Repositories } from './repositories.ts';

/**
 * Um banco de dados plugável. Implementações: SqlDataSource (abstrata) →
 * SqliteDataSource; futuramente PostgresDataSource ou um banco não-SQL.
 */
export interface DataSource {
  readonly driver: string;
  /** Conecta, aplica migrations e confere a conexão. */
  init(): Promise<void>;
  readonly repositories: Repositories;
  close(): Promise<void>;
}
