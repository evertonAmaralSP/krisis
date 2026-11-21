/**
 * Contrato da API v1. Fonte da verdade para servidor, frontend e OpenAPI.
 * Mudança que quebra compatibilidade não entra aqui: vira contracts/src/v2.
 */
import { z } from 'zod';

// ---------- Comuns ----------

export const ErrorBody = z
  .object({
    error: z.object({
      code: z.string().meta({ example: 'NOT_FOUND' }),
      message: z.string(),
    }),
  })
  .meta({ id: 'ErrorBody' });
export type ErrorBody = z.infer<typeof ErrorBody>;

export const IdParams = z.object({ id: z.string().min(1) });

// ---------- Autenticação e conta ----------

export const User = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
  })
  .meta({ id: 'User' });
export type User = z.infer<typeof User>;

export const LoginBody = z
  .object({
    email: z.email(),
    password: z.string().min(1),
  })
  .meta({ id: 'LoginBody' });
export type LoginBody = z.infer<typeof LoginBody>;

export const MeResponse = z.object({ user: User }).meta({ id: 'MeResponse' });
export type MeResponse = z.infer<typeof MeResponse>;

// ---------- Entrevistas ----------

export const Level = z.enum(['junior', 'pleno', 'senior']).meta({ id: 'Level' });
export type Level = z.infer<typeof Level>;

export const InterviewKind = z
  .enum(['comportamental', 'tecnica', 'mista'])
  .meta({ id: 'InterviewKind' });
export type InterviewKind = z.infer<typeof InterviewKind>;

export const InterviewStatus = z.enum(['active', 'finished']).meta({ id: 'InterviewStatus' });
export type InterviewStatus = z.infer<typeof InterviewStatus>;

export const MessageAuthor = z.enum(['interviewer', 'candidate']).meta({ id: 'MessageAuthor' });
export type MessageAuthor = z.infer<typeof MessageAuthor>;

export const InputMode = z.enum(['text', 'voice']).meta({ id: 'InputMode' });
export type InputMode = z.infer<typeof InputMode>;

export const Timings = z
  .object({
    sttMs: z.number().int().nullable(),
    llmMs: z.number().int().nullable(),
    ttsMs: z.number().int().nullable(),
  })
  .meta({ id: 'Timings' });
export type Timings = z.infer<typeof Timings>;

export const Message = z
  .object({
    id: z.string(),
    interviewId: z.string(),
    author: MessageAuthor,
    content: z.string(),
    inputMode: InputMode.nullable(),
    audioSeconds: z.number().nullable(),
    timings: Timings,
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'Message' });
export type Message = z.infer<typeof Message>;

export const Engines = z
  .object({
    stt: z.string().nullable(),
    llm: z.string(),
    tts: z.string().nullable(),
  })
  .meta({ id: 'Engines' });
export type Engines = z.infer<typeof Engines>;

export const InterviewSummary = z
  .object({
    id: z.string(),
    role: z.string(),
    company: z.string(),
    level: Level,
    kind: InterviewKind,
    status: InterviewStatus,
    createdAt: z.iso.datetime(),
    finishedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'InterviewSummary' });
export type InterviewSummary = z.infer<typeof InterviewSummary>;

export const Interview = InterviewSummary.extend({
  jobDescription: z.string().nullable(),
  resume: z.string().nullable(),
  engines: Engines,
  messages: z.array(Message),
}).meta({ id: 'Interview' });
export type Interview = z.infer<typeof Interview>;

export const CreateInterviewBody = z
  .object({
    role: z.string().trim().min(2).max(120),
    company: z.string().trim().min(1).max(120),
    level: Level,
    kind: InterviewKind,
    jobDescription: z.string().trim().max(20_000).optional(),
    resume: z.string().trim().max(20_000).optional(),
  })
  .meta({ id: 'CreateInterviewBody' });
export type CreateInterviewBody = z.infer<typeof CreateInterviewBody>;

export const InterviewList = z
  .object({ items: z.array(InterviewSummary) })
  .meta({ id: 'InterviewList' });
export type InterviewList = z.infer<typeof InterviewList>;

// ---------- Turno ----------

/**
 * POST /interviews/{id}/transcriptions — multipart/form-data com o campo `audio`.
 * Não grava nada: o texto volta para o cliente, que o envia em POST /messages.
 */
export const TRANSCRIPTION_AUDIO_FIELD = 'audio';
export const TRANSCRIPTION_MAX_BYTES = 10 * 1024 * 1024;
/** Tipos aceitos (sem parâmetros de codec). O MediaRecorder grava webm (Chrome, Firefox) ou mp4 (Safari). */
export const TRANSCRIPTION_AUDIO_TYPES = [
  'audio/webm',
  'video/webm',
  'audio/ogg',
  'audio/mp4',
  'video/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/flac',
  'audio/x-flac',
] as const;

export const TranscriptionResponse = z
  .object({
    text: z.string(),
    sttMs: z.number().int().nonnegative(),
    engine: z.string(),
    model: z.string(),
  })
  .meta({ id: 'TranscriptionResponse' });
export type TranscriptionResponse = z.infer<typeof TranscriptionResponse>;

export const SendMessageBody = z
  .object({
    content: z.string().trim().min(1).max(10_000),
    inputMode: InputMode.default('text'),
    /** Preenchidos pelo cliente quando o texto veio de POST /transcriptions. */
    audioSeconds: z.number().positive().optional(),
    sttMs: z.number().int().nonnegative().optional(),
  })
  .meta({ id: 'SendMessageBody' });
export type SendMessageBody = z.input<typeof SendMessageBody>;

export const SendMessageResponse = z
  .object({
    candidateMessage: Message,
    interviewerMessage: Message,
  })
  .meta({ id: 'SendMessageResponse' });
export type SendMessageResponse = z.infer<typeof SendMessageResponse>;
