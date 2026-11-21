/**
 * Rotas da API v1. Handlers finos: validam pelo contrato, chamam o serviço
 * e traduzem o resultado. Toda a lógica fica em application/.
 */
import { v1 } from '@krisis/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Services } from '../../container.ts';
import { AppError } from '../../domain/errors.ts';
import { currentUser, requireSession, SESSION_COOKIE } from './session.ts';
import { toInterviewDto, toInterviewSummaryDto, toMessageDto, toUserDto } from './mappers.ts';

export interface V1Options {
  services: Services;
  cookieSecure: boolean;
}

const errors = (...codes: (400 | 401 | 404 | 409 | 413 | 415 | 422 | 502)[]) =>
  Object.fromEntries(codes.map((c) => [c, v1.ErrorBody]));

export const v1Routes: FastifyPluginAsyncZod<V1Options> = async (app, { services, cookieSecure }) => {
  // ---------- Públicas ----------

  app.post(
    '/auth/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Entrar',
        description: 'Confere e-mail e senha e grava o cookie de sessão (httpOnly).',
        body: v1.LoginBody,
        response: { 200: v1.MeResponse, ...errors(400, 401) },
      },
    },
    async (request, reply) => {
      const { token, user, expiresAt } = await services.auth.login(
        request.body.email,
        request.body.password,
      );
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieSecure,
        path: '/',
        expires: expiresAt,
      });
      return { user: toUserDto(user) };
    },
  );

  // ---------- Protegidas ----------

  await app.register(async (secured) => {
    secured.decorateRequest('auth', null);
    secured.addHook('onRequest', requireSession(services.auth));
    const s = secured.withTypeProvider<import('fastify-type-provider-zod').ZodTypeProvider>();

    s.post(
      '/auth/logout',
      {
        schema: {
          tags: ['auth'],
          summary: 'Sair',
          security: [{ cookieAuth: [] }],
          response: { 204: z.null(), ...errors(401) },
        },
      },
      async (request, reply) => {
        await services.auth.logout(request.auth!.sessionId);
        reply.clearCookie(SESSION_COOKIE, { path: '/' });
        return reply.code(204).send(null);
      },
    );

    s.get(
      '/auth/me',
      {
        schema: {
          tags: ['auth'],
          summary: 'Usuário da sessão',
          security: [{ cookieAuth: [] }],
          response: { 200: v1.MeResponse, ...errors(401) },
        },
      },
      async (request) => ({ user: toUserDto(currentUser(request)) }),
    );

    s.get(
      '/interviews',
      {
        schema: {
          tags: ['interviews'],
          summary: 'Listar entrevistas (mais recentes primeiro)',
          security: [{ cookieAuth: [] }],
          response: { 200: v1.InterviewList, ...errors(401) },
        },
      },
      async (request) => {
        const items = await services.interviews.list(currentUser(request).id);
        return { items: items.map(toInterviewSummaryDto) };
      },
    );

    s.post(
      '/interviews',
      {
        schema: {
          tags: ['interviews'],
          summary: 'Criar entrevista',
          description: 'Cria a entrevista e devolve a primeira pergunta do entrevistador em `messages`.',
          security: [{ cookieAuth: [] }],
          body: v1.CreateInterviewBody,
          response: { 201: v1.Interview, ...errors(400, 401, 502) },
        },
      },
      async (request, reply) => {
        const b = request.body;
        const created = await services.interviews.create(currentUser(request).id, {
          role: b.role,
          company: b.company,
          level: b.level,
          kind: b.kind,
          jobDescription: b.jobDescription || null,
          resume: b.resume || null,
        });
        return reply.code(201).send(toInterviewDto(created));
      },
    );

    s.get(
      '/interviews/:id',
      {
        schema: {
          tags: ['interviews'],
          summary: 'Entrevista com todas as mensagens',
          security: [{ cookieAuth: [] }],
          params: v1.IdParams,
          response: { 200: v1.Interview, ...errors(401, 404) },
        },
      },
      async (request) =>
        toInterviewDto(await services.interviews.get(currentUser(request).id, request.params.id)),
    );

    s.post(
      '/interviews/:id/transcriptions',
      {
        schema: {
          tags: ['interviews'],
          summary: 'Transcrever a fala do candidato',
          description:
            'Recebe o áudio gravado (multipart/form-data, campo `audio`) e devolve o texto. Não grava nada: o cliente confirma o texto em POST /interviews/{id}/messages com `inputMode: "voice"`. Responde 422 quando não há fala reconhecível.',
          security: [{ cookieAuth: [] }],
          consumes: ['multipart/form-data'],
          params: v1.IdParams,
          response: { 200: v1.TranscriptionResponse, ...errors(400, 401, 404, 409, 413, 415, 422, 502) },
        },
      },
      async (request) => {
        if (!request.isMultipart()) {
          throw new AppError('UNSUPPORTED_MEDIA', 'Envie o áudio como multipart/form-data no campo "audio".');
        }
        const file = await request.file();
        if (!file || file.fieldname !== v1.TRANSCRIPTION_AUDIO_FIELD) {
          throw new AppError('BAD_REQUEST', 'Envie o áudio no campo "audio".');
        }
        if (!isAudioType(file.mimetype)) {
          throw new AppError('UNSUPPORTED_MEDIA', `Formato de áudio não suportado: ${file.mimetype}.`);
        }
        const audio = await file.toBuffer();
        return services.transcription.transcribe(currentUser(request).id, request.params.id, {
          audio,
          mimeType: file.mimetype,
        });
      },
    );

    s.post(
      '/interviews/:id/messages',
      {
        schema: {
          tags: ['interviews'],
          summary: 'Enviar a fala do candidato e receber a resposta do entrevistador',
          description:
            'Usado pelo turno por texto e pelo turno por voz (depois de POST /transcriptions). Se o modelo falhar, nada é gravado e a mesma fala pode ser reenviada.',
          security: [{ cookieAuth: [] }],
          params: v1.IdParams,
          body: v1.SendMessageBody,
          response: { 200: v1.SendMessageResponse, ...errors(400, 401, 404, 409, 502) },
        },
      },
      async (request) => {
        const { candidateMessage, interviewerMessage } = await services.conversation.reply(
          currentUser(request).id,
          request.params.id,
          {
            content: request.body.content,
            inputMode: request.body.inputMode,
            audioSeconds: request.body.audioSeconds,
            sttMs: request.body.sttMs,
          },
        );
        return {
          candidateMessage: toMessageDto(candidateMessage),
          interviewerMessage: toMessageDto(interviewerMessage),
        };
      },
    );
  });
};

/** Só os tipos do contrato: um tipo desconhecido recebe 415 claro, em vez de falhar no fornecedor. */
function isAudioType(mimeType: string): boolean {
  const base = mimeType.split(';')[0]!.trim().toLowerCase();
  return (v1.TRANSCRIPTION_AUDIO_TYPES as readonly string[]).includes(base);
}
