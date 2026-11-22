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
export const VoiceParams = z.object({ voice: z.string().regex(/^[a-z0-9_-]{1,40}$/) });

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

export const Account = User.extend({
  /** Voz preferida do entrevistador; null = padrão do servidor (TTS_VOICE). */
  ttsVoice: z.string().nullable(),
}).meta({ id: 'Account' });
export type Account = z.infer<typeof Account>;

export const UpdateAccountBody = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    email: z.email().optional(),
    /** Obrigatória só para trocar o e-mail. */
    currentPassword: z.string().min(1).optional(),
    ttsVoice: z
      .string()
      .regex(/^[a-z0-9_-]{1,40}$/)
      .nullable()
      .optional(),
  })
  .meta({ id: 'UpdateAccountBody' });
export type UpdateAccountBody = z.infer<typeof UpdateAccountBody>;

export const PASSWORD_MIN = 12;
export const ChangePasswordBody = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(PASSWORD_MIN).max(200),
  })
  .meta({ id: 'ChangePasswordBody' });
export type ChangePasswordBody = z.infer<typeof ChangePasswordBody>;
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

/**
 * GET /messages/{id}/speech?part=N — áudio de UMA frase da fala do entrevistador.
 * O cabeçalho x-speech-parts diz quantas frases há; o cliente toca a parte N
 * enquanto pede a N+1. x-tts-ms traz o tempo de síntese da parte.
 */
export const SPEECH_PARTS_HEADER = 'x-speech-parts';
export const SPEECH_MS_HEADER = 'x-tts-ms';
// Sem .meta({ id }): o @fastify/swagger não resolve $ref em query string.
export const SpeechQuery = z.object({
  part: z.coerce.number().int().nonnegative().default(0),
  /** Opcional: toca com outra voz da lista de GET /speech/voices (comparar vozes). */
  voice: z
    .string()
    .regex(/^[a-z0-9_-]{1,40}$/)
    .optional(),
});

export const Voice = z.object({ id: z.string(), label: z.string() }).meta({ id: 'Voice' });
export type Voice = z.infer<typeof Voice>;

export const VoiceList = z
  .object({
    /** Voz usada na reprodução automática (preferida da pessoa ou TTS_VOICE). */
    default: z.string(),
    /** false com TTS_ENGINE=none: não há voz no servidor. */
    enabled: z.boolean(),
    voices: z.array(Voice),
  })
  .meta({ id: 'VoiceList' });
export type VoiceList = z.infer<typeof VoiceList>;
export type SpeechQuery = z.infer<typeof SpeechQuery>;

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
