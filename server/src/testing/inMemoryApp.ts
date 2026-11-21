/**
 * Aplicação completa em memória: SQLite ':memory:' e motor de linguagem falso.
 * Usada pelos testes e pela geração do OpenAPI. Não precisa de chave de API.
 */
import { pino } from 'pino';
import { buildApp } from '../app.ts';
import { createServices } from '../container.ts';
import { CachedLlmResolver } from '../application/LlmResolver.ts';
import { SqliteDataSource } from '../infra/datasource/sqlite/SqliteDataSource.ts';
import { FakeLlmEngine, type FakeLlmOptions } from '../infra/engines/fake/FakeLlmEngine.ts';
import { Argon2PasswordHasher } from '../infra/security/Argon2PasswordHasher.ts';

export const TEST_USER = { name: 'Pessoa Teste', email: 'teste@exemplo.com', password: 'senha-de-teste-123' };

export async function buildInMemoryApp(llmOptions: FakeLlmOptions = {}) {
  const logger = pino({ level: 'silent' });
  const dataSource = new SqliteDataSource(':memory:');
  await dataSource.init();
  const hasher = new Argon2PasswordHasher();
  const llm = new FakeLlmEngine(logger, llmOptions);
  const services = createServices({
    repos: dataSource.repositories,
    llm: new CachedLlmResolver(() => llm, 'fake'),
    hasher,
    sessionTtlDays: 30,
  });
  await services.auth.bootstrapAdmin(
    { name: TEST_USER.name, email: TEST_USER.email, passwordHash: await hasher.hash(TEST_USER.password) },
    { info: () => {}, warn: () => {} },
  );
  const app = await buildApp({ services, logger, cookieSecure: false });
  await app.ready();
  return {
    app,
    llm,
    dataSource,
    services,
    async close() {
      await app.close();
      await dataSource.close();
    },
  };
}
