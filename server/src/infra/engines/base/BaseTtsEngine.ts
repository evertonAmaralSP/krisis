import { AppError, EngineError } from '../../../domain/errors.ts';
import type { EngineLogger, TtsEngine, TtsRequest, TtsResult } from '../../../ports/engines.ts';

export interface TtsAudio {
  audio: Buffer;
  mimeType: TtsResult['mimeType'];
}

/**
 * Template method de toda voz:
 *
 *   validate()  →  medir tempo  →  doSynthesize()  →  padronizar erro  →  registrar no log
 *
 * Um motor novo implementa só `doSynthesize()` e declara o formato do áudio.
 * Não sobrescreva `synthesize()`.
 */
export abstract class BaseTtsEngine implements TtsEngine {
  abstract readonly name: string;

  constructor(protected readonly logger: EngineLogger) {}

  async synthesize(request: TtsRequest): Promise<TtsResult> {
    this.validate(request);
    const started = performance.now();
    let out: TtsAudio;
    try {
      out = await this.doSynthesize(request);
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      this.logger.error(
        { stage: 'tts', engine: this.name, ms, err: err instanceof Error ? err.message : String(err) },
        'falha na voz',
      );
      if (err instanceof EngineError) throw err;
      throw new EngineError(this.name, 'tts', 'A voz do entrevistador não respondeu. O serviço de voz está rodando?', {
        cause: err,
      });
    }
    const ms = Math.round(performance.now() - started);
    if (out.audio.length === 0) {
      throw new EngineError(this.name, 'tts', 'A voz devolveu um áudio vazio.');
    }
    this.logger.info(
      { stage: 'tts', engine: this.name, ms, chars: request.text.length, bytes: out.audio.length },
      'tts concluído',
    );
    return { audio: out.audio, mimeType: out.mimeType, engine: this.name, ms };
  }

  /** Passo variável: chamar o fornecedor. */
  protected abstract doSynthesize(request: TtsRequest): Promise<TtsAudio>;

  protected validate(request: TtsRequest): void {
    if (!request.text.trim()) throw new AppError('BAD_REQUEST', 'Não há texto para falar.');
  }
}
