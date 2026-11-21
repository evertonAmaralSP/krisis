import { AppError, EngineError } from '../../../domain/errors.ts';
import type { EngineLogger, SttEngine, SttRequest, SttResult } from '../../../ports/engines.ts';

export interface SttTranscription {
  text: string;
  model: string;
}

/**
 * Template method de toda transcrição:
 *
 *   validate()  →  medir tempo  →  doTranscribe()  →  padronizar erro  →  registrar no log
 *
 * Um motor novo implementa só `doTranscribe()`. Não sobrescreva `transcribe()`.
 * Texto vazio não é erro aqui: decidir se a fala foi entendida é da aplicação.
 */
export abstract class BaseSttEngine implements SttEngine {
  abstract readonly name: string;

  constructor(protected readonly logger: EngineLogger) {}

  async transcribe(request: SttRequest): Promise<SttResult> {
    this.validate(request);
    const started = performance.now();
    let out: SttTranscription;
    try {
      out = await this.doTranscribe(request);
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      this.logger.error(
        { stage: 'stt', engine: this.name, ms, err: err instanceof Error ? err.message : String(err) },
        'falha na transcrição',
      );
      if (err instanceof EngineError) throw err;
      throw new EngineError(this.name, 'stt', 'A transcrição da fala falhou. Tente de novo.', { cause: err });
    }
    const ms = Math.round(performance.now() - started);
    this.logger.info(
      { stage: 'stt', engine: this.name, model: out.model, ms, bytes: request.audio.length },
      'stt concluído',
    );
    return { text: out.text.trim(), model: out.model, engine: this.name, ms };
  }

  /** Passo variável: chamar o fornecedor. */
  protected abstract doTranscribe(request: SttRequest): Promise<SttTranscription>;

  protected validate(request: SttRequest): void {
    if (request.audio.length === 0) throw new AppError('BAD_REQUEST', 'O arquivo de áudio está vazio.');
  }
}
