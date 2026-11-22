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
/** "pf_dora" → "Dora (feminina)": convenção do Kokoro, 2ª letra f/m. */
export function voiceLabel(id: string): string {
  const name = id.split('_').slice(1).join(' ') || id;
  const nice = name.charAt(0).toUpperCase() + name.slice(1);
  const gender = id[1] === 'f' ? ' (feminina)' : id[1] === 'm' ? ' (masculina)' : '';
  return `${nice}${gender}`;
}

export class SpeechService {
  constructor(
    private readonly repos: Repositories,
    private readonly tts: TtsResolver,
    private readonly voices: { default: string; available: string[] } = { default: '', available: [] },
  ) {}

  listVoices(): { default: string; voices: { id: string; label: string }[] } {
    const ids = this.voices.available.includes(this.voices.default)
      ? this.voices.available
      : [this.voices.default, ...this.voices.available].filter(Boolean);
    return { default: this.voices.default, voices: ids.map((id) => ({ id, label: voiceLabel(id) })) };
  }

  async speak(userId: string, messageId: string, part: number, voice?: string): Promise<SpeechPart> {
    if (voice !== undefined && !this.listVoices().voices.some((v) => v.id === voice)) {
      throw new AppError('BAD_REQUEST', `Voz não disponível: ${voice}.`);
    }
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

    const result = await this.tts.get(engineName).synthesize({ text, ...(voice !== undefined && { voice }) });
    // Guarda só a primeira medição na voz padrão: é a espera que a pessoa teve de fato
    // (replays e comparações de voz não contam).
    if (part === 0 && voice === undefined && message.timings.ttsMs === null) {
      await this.repos.messages.setTtsMs(message.id, result.ms);
    }
    return { audio: result.audio, mimeType: result.mimeType, part, parts: sentences.length, ms: result.ms };
  }
}
