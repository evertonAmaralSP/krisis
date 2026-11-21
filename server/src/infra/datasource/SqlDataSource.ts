import { Kysely, sql, type Dialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import type { DataSource } from '../../ports/datasource.ts';
import type { Repositories } from '../../ports/repositories.ts';
import type { Database } from './sql/schema.ts';
import { migrationProvider } from './sql/migrations.ts';
import { createSqlRepositories } from './sql/repositories.ts';

/**
 * Base de todo banco SQL. `init()` é o template method do ciclo de vida:
 *
 *   createDialect()  →  afterConnect()  →  migrate()  →  healthcheck()
 *
 * Um banco SQL novo implementa só `createDialect()` (e, se precisar,
 * `afterConnect()`). Repositórios e migrations são compartilhados.
 * Não sobrescreva `init()`: o TypeScript não tem `final`, então isso é
 * garantido por convenção e pelos testes.
 */
export abstract class SqlDataSource implements DataSource {
  abstract readonly driver: string;

  private db: Kysely<Database> | null = null;
  private repos: Repositories | null = null;

  /** Passo obrigatório: o dialeto Kysely do banco. */
  protected abstract createDialect(): Dialect;

  /** Gancho opcional: ajustes de conexão (pragmas, search_path...). */
  protected async afterConnect(_db: Kysely<Database>): Promise<void> {}

  async init(): Promise<void> {
    if (this.db) return;
    const db = new Kysely<Database>({ dialect: this.createDialect() });
    try {
      await this.afterConnect(db);
      await this.migrate(db);
      await this.healthcheck(db);
    } catch (err) {
      await db.destroy();
      throw err;
    }
    this.db = db;
    this.repos = createSqlRepositories(db);
  }

  get repositories(): Repositories {
    if (!this.repos) throw new Error(`DataSource ${this.driver} não inicializado: chame init().`);
    return this.repos;
  }

  async close(): Promise<void> {
    await this.db?.destroy();
    this.db = null;
    this.repos = null;
  }

  private async migrate(db: Kysely<Database>) {
    const migrator = new Migrator({ db, provider: migrationProvider });
    const { error, results } = await migrator.migrateToLatest();
    const failed = results?.find((r) => r.status === 'Error');
    if (error || failed) {
      throw new Error(`Falha ao migrar o banco (${failed?.migrationName ?? 'desconhecida'}).`, {
        cause: error,
      });
    }
  }

  private async healthcheck(db: Kysely<Database>) {
    await sql`select 1`.execute(db);
  }
}
