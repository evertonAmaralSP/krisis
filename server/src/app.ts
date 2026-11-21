/**
 * Monta a aplicação Fastify sem chamar listen(). Serve tanto ao servidor
 * local (main.ts) quanto a testes e a uma futura função serverless.
 */
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyBaseLogger, type FastifyError, type FastifyInstance } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Logger } from 'pino';
import { AppError, EngineError, type ErrorCode } from './domain/errors.ts';
import type { Services } from './container.ts';
import { v1Routes } from './http/v1/routes.ts';
import { SESSION_COOKIE } from './http/v1/session.ts';

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ENGINE_FAILURE: 502,
  INTERNAL: 500,
};

export interface BuildAppOptions {
  services: Services;
  logger: Logger;
  cookieSecure: boolean;
}

export async function buildApp({ services, logger, cookieSecure }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: logger as unknown as FastifyBaseLogger,
    bodyLimit: 1_048_576,
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cookie);

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'KRISIS API',
        version: '1.0.0',
        description: 'API do portal de treino de entrevistas. Versão no caminho: /api/v1.',
      },
      tags: [
        { name: 'auth', description: 'Sessão' },
        { name: 'interviews', description: 'Entrevistas e turnos' },
      ],
      components: {
        securitySchemes: {
          cookieAuth: { type: 'apiKey', in: 'cookie', name: SESSION_COOKIE },
        },
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, { routePrefix: '/api/v1/docs' });

  app.setErrorHandler((err: FastifyError | AppError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      const detail = err.validation
        .map((v) => `${v.instancePath.replace(/^\//, '').replaceAll('/', '.') || 'corpo'}: ${v.message}`)
        .join('; ');
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: `Dados inválidos. ${detail}` } });
    }
    if (err instanceof AppError) {
      const status = STATUS[err.code];
      if (err instanceof EngineError || status >= 500) request.log.error({ err }, err.message);
      return reply.code(status).send({ error: { code: err.code, message: err.message } });
    }
    const status = (err as FastifyError).statusCode ?? 500;
    if (status < 500) {
      return reply.code(status).send({ error: { code: 'BAD_REQUEST', message: err.message } });
    }
    request.log.error({ err }, 'erro inesperado');
    return reply.code(500).send({ error: { code: 'INTERNAL', message: 'Erro interno. Veja o log do servidor.' } });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: `Rota ${request.method} ${request.url} não existe.` } }),
  );

  await app.register(v1Routes, { prefix: '/api/v1', services, cookieSecure });

  app.get('/api/v1/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  return app;
}
