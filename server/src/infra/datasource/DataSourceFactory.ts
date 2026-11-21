import type { DataSource } from '../../ports/datasource.ts';
import type { AppConfig } from '../../config.ts';
import { SqliteDataSource } from './sqlite/SqliteDataSource.ts';

type Builder = (config: AppConfig) => DataSource;

/**
 * Escolhe o banco pela variável DB_DRIVER. Um banco novo = uma classe
 * que implementa DataSource + uma linha em `register`.
 */
export class DataSourceFactory {
  private readonly builders = new Map<string, Builder>();

  register(driver: string, builder: Builder): this {
    this.builders.set(driver, builder);
    return this;
  }

  create(config: AppConfig): DataSource {
    const builder = this.builders.get(config.db.driver);
    if (!builder) {
      throw new Error(
        `DB_DRIVER "${config.db.driver}" desconhecido. Disponíveis: ${[...this.builders.keys()].join(', ')}.`,
      );
    }
    return builder(config);
  }
}

export const defaultDataSourceFactory = () =>
  new DataSourceFactory().register('sqlite', (c) => new SqliteDataSource(c.db.sqlitePath));
