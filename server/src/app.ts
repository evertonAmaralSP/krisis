/**
 * Monta a aplicação Fastify sem chamar listen(). Serve tanto ao servidor
 * local (main.ts) quanto a testes e a uma futura função serverless.
 */
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
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
import { v1 } from '@krisis/contracts';
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
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA: 415,
  NO_SPEECH: 422,
  TTS_DISABLED: 404,
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
  await app.register(multipart, {
    limits: { fileSize: v1.TRANSCRIPTION_MAX_BYTES, files: 1, fields: 0, parts: 1 },
  });

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
    transformObject: (documentObject) => withMultipartBodies(jsonSchemaTransformObject(documentObject)),
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
    if (status === 413) {
      const mb = Math.round(v1.TRANSCRIPTION_MAX_BYTES / 1024 / 1024);
      const message =
        (err as FastifyError).code === 'FST_REQ_FILE_TOO_LARGE'
          ? `Áudio maior que ${mb} MB. Grave uma resposta mais curta.`
          : 'Requisição grande demais ou com partes a mais do que o permitido.';
      return reply.code(413).send({ error: { code: 'PAYLOAD_TOO_LARGE', message } });
    }
    if (status === 406 || status === 415) {
      return reply.code(415).send({ error: { code: 'UNSUPPORTED_MEDIA', message: 'Envie o áudio como multipart/form-data no campo "audio".' } });
    }
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

/**
 * O validador é zod e o corpo multipart não passa por ele, então a rota de
 * transcrição não declara `body`. Aqui o OpenAPI recebe a descrição do upload.
 */
function withMultipartBodies<T>(doc: T): T {
  const paths = (doc as { paths?: Record<string, Record<string, Record<string, unknown>>> }).paths;
  const op = paths?.['/api/v1/interviews/{id}/transcriptions']?.post;
  if (op) {
    op.requestBody = {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            required: [v1.TRANSCRIPTION_AUDIO_FIELD],
            properties: {
              [v1.TRANSCRIPTION_AUDIO_FIELD]: {
                type: 'string',
                format: 'binary',
                description: `Áudio gravado (webm, ogg, mp4/m4a, mp3, wav ou flac), até ${v1.TRANSCRIPTION_MAX_BYTES / 1024 / 1024} MB.`,
              },
            },
          },
        },
      },
    };
  }
  const speech = paths?.['/api/v1/messages/{id}/speech']?.get as { responses?: Record<string, unknown> } | undefined;
  if (speech) {
    speech.responses = {
      200: {
        description: 'Áudio da frase pedida.',
        headers: {
          [v1.SPEECH_PARTS_HEADER]: { description: 'Total de frases da fala.', schema: { type: 'integer' } },
          [v1.SPEECH_MS_HEADER]: { description: 'Tempo de síntese desta frase, em ms.', schema: { type: 'integer' } },
        },
        content: {
          'audio/wav': { schema: { type: 'string', format: 'binary' } },
          'audio/mpeg': { schema: { type: 'string', format: 'binary' } },
          'audio/ogg': { schema: { type: 'string', format: 'binary' } },
        },
      },
      ...speech.responses,
    };
  }
  return doc;
}
