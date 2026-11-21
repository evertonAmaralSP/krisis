/**
 * Zera o banco SQLite local e recria a conta a partir do .env.
 *
 *   npm run reset-db            pede confirmação
 *   npm run reset-db -- --sim   sem confirmação
 *
 * Apaga TODAS as entrevistas. Recusa rodar com o servidor no ar, porque o
 * processo aberto continuaria gravando no arquivo apagado.
 */
import { existsSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { loadConfig, loadDotEnv } from '../config.ts';
import { AuthService } from '../application/AuthService.ts';
import { defaultDataSourceFactory } from '../infra/datasource/DataSourceFactory.ts';
import { Argon2PasswordHasher } from '../infra/security/Argon2PasswordHasher.ts';

loadDotEnv();
const config = loadConfig();

async function serverIsUp(): Promise<boolean> {
  try {
    await fetch(`http://${config.host}:${config.port}/api/v1/openapi.json`, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

async function confirm(): Promise<boolean> {
  if (process.argv.includes('--sim')) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Isto apaga TODAS as entrevistas. Digite "zerar" para confirmar: ');
  rl.close();
  return answer.trim().toLowerCase() === 'zerar';
}

try {
  if (config.db.driver !== 'sqlite') throw new Error(`reset-db só funciona com DB_DRIVER=sqlite (atual: ${config.db.driver}).`);
  const path = config.db.sqlitePath;
  if (path === ':memory:') throw new Error('SQLITE_PATH=:memory: não tem arquivo para apagar.');
  if (await serverIsUp()) {
    throw new Error(`O servidor está rodando em ${config.host}:${config.port}. Pare o "npm run dev" (Ctrl+C) e rode de novo.`);
  }

  console.log(`Banco: ${path}`);
  if (!(await confirm())) {
    console.log('Cancelado. Nada foi apagado.');
    process.exit(0);
  }

  // Nomes exatos: o banco e os arquivos auxiliares do modo WAL.
  for (const file of [path, `${path}-wal`, `${path}-shm`]) {
    if (existsSync(file)) {
      rmSync(file);
      console.log(`  apagado: ${file}`);
    }
  }

  const dataSource = defaultDataSourceFactory().create(config);
  await dataSource.init();
  const auth = new AuthService(dataSource.repositories, new Argon2PasswordHasher(), config.session.ttlDays);
  await auth.bootstrapAdmin(config.admin, {
    info: (m) => console.log(m),
    warn: (m) => console.warn(`Atenção: ${m}`),
  });
  await dataSource.close();
  console.log('Banco zerado. Entre com o e-mail acima e a senha que gerou o ADMIN_PASSWORD_HASH.');
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
