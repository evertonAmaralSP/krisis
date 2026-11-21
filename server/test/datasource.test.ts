import { afterEach, describe, expect, it, vi } from 'vitest';
import { SqliteDialect, type Dialect } from 'kysely';
import BetterSqlite3 from 'better-sqlite3';
import { loadConfig } from '../src/config.ts';
import { DataSourceFactory, defaultDataSourceFactory } from '../src/infra/datasource/DataSourceFactory.ts';
import { SqlDataSource } from '../src/infra/datasource/SqlDataSource.ts';
import { SqliteDataSource } from '../src/infra/datasource/sqlite/SqliteDataSource.ts';

const open: { close(): Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((d) => d.close()));
});

async function memory() {
  const ds = new SqliteDataSource(':memory:');
  open.push(ds);
  await ds.init();
  return ds;
}

describe('DataSourceFactory', () => {
  it('cria o SQLite a partir de DB_DRIVER', () => {
    const ds = defaultDataSourceFactory().create(loadConfig({ DB_DRIVER: 'sqlite', SQLITE_PATH: ':memory:' }));
    expect(ds).toBeInstanceOf(SqliteDataSource);
  });

  it('explica quando o driver não existe', () => {
    expect(() => defaultDataSourceFactory().create(loadConfig({ DB_DRIVER: 'oracle' }))).toThrow(
      /DB_DRIVER "oracle" desconhecido. Disponíveis: sqlite/,
    );
  });

  it('aceita um banco novo registrando uma classe', () => {
    const f = new DataSourceFactory().register('outro', () => new SqliteDataSource(':memory:'));
    expect(f.create(loadConfig({ DB_DRIVER: 'outro' })).driver).toBe('sqlite');
  });
});

describe('SqlDataSource (template method)', () => {
  it('um banco SQL novo só implementa createDialect; o resto vem da base', async () => {
    const createDialect = vi.fn(
      (): Dialect => new SqliteDialect({ database: new BetterSqlite3(':memory:') }),
    );
    class OutroSql extends SqlDataSource {
      readonly driver = 'outro-sql';
      protected createDialect() {
        return createDialect();
      }
    }
    const ds = new OutroSql();
    open.push(ds);
    await ds.init();
    await ds.init(); // idempotente
    expect(createDialect).toHaveBeenCalledTimes(1);
    expect(await ds.repositories.users.count()).toBe(0); // migrations aplicadas
  });

  it('avisa se usar os repositórios antes de init()', () => {
    expect(() => new SqliteDataSource(':memory:').repositories).toThrow(/init\(\)/);
  });
});

describe('Repositórios SQL', () => {
  it('usuários: cria, busca por e-mail sem diferenciar maiúsculas e atualiza', async () => {
    const { users } = (await memory()).repositories;
    const u = await users.create({ name: 'Ana', email: 'Ana@Exemplo.com', passwordHash: 'h' });
    expect(await users.count()).toBe(1);
    expect((await users.findByEmail('ana@exemplo.com'))?.id).toBe(u.id);
    const updated = await users.update(u.id, { name: 'Ana B.' });
    expect(updated.name).toBe('Ana B.');
  });

  it('sessões: só valem até expirar e podem ser encerradas em lote', async () => {
    const { users, sessions } = (await memory()).repositories;
    const u = await users.create({ name: 'A', email: 'a@a.com', passwordHash: 'h' });
    const now = new Date();
    await sessions.create({ id: 's1', userId: u.id, expiresAt: new Date(now.getTime() + 60_000), createdAt: now });
    await sessions.create({ id: 's2', userId: u.id, expiresAt: new Date(now.getTime() - 1), createdAt: now });
    expect(await sessions.findValid('s1', now)).not.toBeNull();
    expect(await sessions.findValid('s2', now)).toBeNull();
    await sessions.deleteAllForUserExcept(u.id, null);
    expect(await sessions.findValid('s1', now)).toBeNull();
  });

  it('mensagens: gravadas em lote mantêm a ordem; entrevistas são isoladas por usuário', async () => {
    const { users, interviews, messages } = (await memory()).repositories;
    const u = await users.create({ name: 'A', email: 'a@a.com', passwordHash: 'h' });
    const other = await users.create({ name: 'B', email: 'b@b.com', passwordHash: 'h' });
    const i = await interviews.create({
      userId: u.id,
      role: 'Dev',
      company: 'X',
      level: 'pleno',
      kind: 'tecnica',
      jobDescription: null,
      resume: null,
      engines: { stt: null, llm: 'fake', tts: null },
    });
    const base = { interviewId: i.id, inputMode: null, audioSeconds: null, timings: { sttMs: null, llmMs: null, ttsMs: null } };
    await messages.createMany([{ ...base, author: 'interviewer', content: '1' }]);
    await messages.createMany([
      { ...base, author: 'candidate', content: '2' },
      { ...base, author: 'interviewer', content: '3' },
    ]);
    expect((await messages.listByInterview(i.id)).map((m) => m.content)).toEqual(['1', '2', '3']);
    expect(await interviews.findById(i.id, other.id)).toBeNull();
    expect(await interviews.listByUser(u.id)).toHaveLength(1);
  });
});
