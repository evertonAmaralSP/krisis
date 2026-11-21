import { buildApp } from './app.ts';
import { bootstrap, createLogger } from './bootstrap.ts';
import { loadConfig, loadDotEnv } from './config.ts';

loadDotEnv();
const config = loadConfig();
const logger = createLogger(config);

try {
  const { dataSource, services } = await bootstrap(config, logger);
  const app = await buildApp({ services, logger, cookieSecure: config.session.cookieSecure });

  const shutdown = async (signal: string) => {
    logger.info(`Recebido ${signal}, encerrando.`);
    await app.close();
    await dataSource.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: config.host, port: config.port });
  logger.info(
    `Banco: ${dataSource.driver} · Modelo: ${config.llm.engine} (${config.llm.model}) · Documentação: http://${config.host}:${config.port}/api/v1/docs`,
  );
} catch (err) {
  logger.fatal(err instanceof Error ? err.message : err);
  process.exit(1);
}
