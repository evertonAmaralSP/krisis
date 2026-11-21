import { AppError, notFound } from '../domain/errors.ts';
import type { TtsResult } from '../ports/engines.ts';
import type { Repositories } from '../ports/repositories.ts';
import type { TtsResolver } from './LlmResolver.ts';
import { splitSentences } from './speech/sentences.ts';

export const TTS_DISABLED = 'none';

export interface SpeechPart {
  audio: Buffer;
  mimeType: TtsResult['mimeType'];
  part: number;
  parts: number;
  ms: number;
}

/**
 * Fala do entrevistador, frase a frase. O áudio não é guardado (o plano pede só
 * a transcrição); o tempo de síntese da primeira frase vai para a mensagem,
 * porque é ele que define quanto se espera até a voz começar.
 */
export class SpeechService {
  constructor(
    private readonly repos: Repositories,
    private readonly tts: TtsResolver,
  ) {}

  async speak(userId: string, messageId: string, part: number): Promise<SpeechPart> {
    const found = await this.repos.messages.findForUser(messageId, userId);
    if (!found) throw notFound('Mensagem');
    const { message, interview } = found;
    if (message.author !== 'interviewer') {
      throw new AppError('BAD_REQUEST', 'Só as falas do entrevistador têm voz.');
    }

    // TTS_ENGINE=none desliga a voz de todas as entrevistas, inclusive as que gravaram um motor.
    // Entrevistas sem motor gravado (anteriores à etapa 3) usam o padrão.
    const engineName = interview.engines.tts ?? this.tts.defaultName();
    if (this.tts.defaultName() === TTS_DISABLED || engineName === TTS_DISABLED) {
      throw new AppError('TTS_DISABLED', 'A voz do entrevistador está desligada (TTS_ENGINE=none).');
    }

    const sentences = splitSentences(message.content);
    const text = sentences[part];
    if (text === undefined) throw notFound(`Parte ${part} da fala`);

    const result = await this.tts.get(engineName).synthesize({ text });
    // Guarda só a primeira medição: é a espera que a pessoa teve de fato (replays não contam).
    if (part === 0 && message.timings.ttsMs === null) await this.repos.messages.setTtsMs(message.id, result.ms);
    return { audio: result.audio, mimeType: result.mimeType, part, parts: sentences.length, ms: result.ms };
  }
}
