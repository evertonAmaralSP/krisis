/** Liga configuração, banco, motores e serviços. Usado por main.ts e pelos scripts. */
import { pino, type Logger } from 'pino';
import type { AppConfig } from './config.ts';
import { createServices, type Services } from './container.ts';
import { CachedEngineResolver } from './application/LlmResolver.ts';
import { defaultDataSourceFactory } from './infra/datasource/DataSourceFactory.ts';
import { defaultEngineFactory } from './infra/engines/EngineFactory.ts';
import { Argon2PasswordHasher } from './infra/security/Argon2PasswordHasher.ts';
import type { DataSource } from './ports/datasource.ts';

export function createLogger(config: AppConfig): Logger {
  return pino({
    level: config.logLevel,
    ...(config.env === 'development' && {
      transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
    }),
  });
}

export async function bootstrap(config: AppConfig, logger: Logger): Promise<{ dataSource: DataSource; services: Services }> {
  const dataSource = defaultDataSourceFactory().create(config);
  await dataSource.init();

  const engines = defaultEngineFactory({ config, logger });
  // Valida já na partida que os motores padrão existem e estão configurados.
  engines.createLlm();
  engines.createStt();
  if (config.tts.engine !== 'none') engines.createTts();
  const llm = new CachedEngineResolver((name) => engines.createLlm(name), config.llm.engine);
  const stt = new CachedEngineResolver((name) => engines.createStt(name), config.stt.engine);
  const tts = new CachedEngineResolver((name) => engines.createTts(name), config.tts.engine);

  const services = createServices({
    repos: dataSource.repositories,
    llm,
    stt,
    tts,
    voices: { default: config.tts.voice, available: config.tts.voices },
    hasher: new Argon2PasswordHasher(),
    sessionTtlDays: config.session.ttlDays,
  });
  await services.auth.bootstrapAdmin(config.admin, {
    info: (m) => logger.info(m),
    warn: (m) => logger.warn(m),
  });
  return { dataSource, services };
}
