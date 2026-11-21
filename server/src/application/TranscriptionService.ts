import { AppError, conflict, notFound } from '../domain/errors.ts';
import type { Repositories } from '../ports/repositories.ts';
import type { SttResolver } from './LlmResolver.ts';

/**
 * Frases que o Whisper costuma "inventar" quando o áudio é silêncio ou ruído
 * (vêm de legendas de vídeo usadas no treino). Comparadas inteiras, após normalizar.
 */
const SILENCE_HALLUCINATIONS = [
  'legendas pela comunidade amara.org',
  'legendas pela comunidade amara org',
  'legenda adriana zanotto',
  'obrigado por assistir',
  'obrigada por assistir',
  'inscreva-se no canal',
  // Visto na prática com o microfone em silêncio (whisper-large-v3-turbo, pt).
  'e aí',
  'e ai',
  'thank you',
  'thanks for watching',
];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s.!?…"“”'´`-]+$/u, '')
    .replace(/^[\s.!?…"“”'´`-]+/u, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Texto vazio, só pontuação ou uma alucinação conhecida de silêncio. */
export function looksLikeNoSpeech(text: string): boolean {
  const n = normalize(text);
  if (!n || !/[\p{L}\p{N}]/u.test(n)) return true;
  return SILENCE_HALLUCINATIONS.includes(n);
}

export interface TranscriptionInput {
  audio: Buffer;
  mimeType: string;
}

export interface TranscriptionOutput {
  text: string;
  sttMs: number;
  engine: string;
  model: string;
}

/** Áudio → texto. Não grava nada: o cliente confirma o texto em POST /messages. */
export class TranscriptionService {
  constructor(
    private readonly repos: Repositories,
    private readonly stt: SttResolver,
  ) {}

  async transcribe(userId: string, interviewId: string, input: TranscriptionInput): Promise<TranscriptionOutput> {
    const interview = await this.repos.interviews.findById(interviewId, userId);
    if (!interview) throw notFound('Entrevista');
    if (interview.status !== 'active') throw conflict('Esta entrevista já foi encerrada.');

    // Entrevistas da etapa 1 não têm motor de transcrição gravado: usam o padrão.
    const engine = this.stt.get(interview.engines.stt ?? this.stt.defaultName());
    const result = await engine.transcribe({
      audio: input.audio,
      mimeType: input.mimeType,
      prompt: `Resposta em uma entrevista de emprego para a vaga de ${interview.role} na empresa ${interview.company}.`,
    });

    if (looksLikeNoSpeech(result.text)) {
      throw new AppError('NO_SPEECH', 'Não entendi a sua fala. Grave de novo, mais perto do microfone.');
    }
    return { text: result.text, sttMs: result.ms, engine: result.engine, model: result.model };
  }
}
