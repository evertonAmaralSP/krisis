import { AppError, EngineError } from '../../../domain/errors.ts';
import type { EngineLogger, LlmEngine, LlmRequest, LlmResult } from '../../../ports/engines.ts';

export interface LlmCompletion {
  text: string;
  model: string;
}

/**
 * Template method de todo modelo de linguagem:
 *
 *   validate()  →  medir tempo  →  doComplete()  →  padronizar erro  →  registrar no log
 *
 * Um motor novo implementa só `doComplete()`. Não sobrescreva `complete()`.
 */
export abstract class BaseLlmEngine implements LlmEngine {
  abstract readonly name: string;

  constructor(protected readonly logger: EngineLogger) {}

  async complete(request: LlmRequest): Promise<LlmResult> {
    this.validate(request);
    const started = performance.now();
    let completion: LlmCompletion;
    try {
      completion = await this.doComplete(request);
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      this.logger.error(
        { stage: 'llm', engine: this.name, ms, err: err instanceof Error ? err.message : String(err) },
        'falha no modelo de linguagem',
      );
      if (err instanceof EngineError) throw err;
      throw new EngineError(this.name, 'llm', 'O modelo de linguagem não respondeu. Tente de novo.', {
        cause: err,
      });
    }
    const ms = Math.round(performance.now() - started);
    const text = completion.text.trim();
    if (!text) {
      this.logger.error({ stage: 'llm', engine: this.name, ms }, 'modelo devolveu texto vazio');
      throw new EngineError(this.name, 'llm', 'O modelo de linguagem devolveu uma resposta vazia.');
    }
    this.logger.info({ stage: 'llm', engine: this.name, model: completion.model, ms }, 'llm concluído');
    return { text, model: completion.model, engine: this.name, ms };
  }

  /** Passo variável: chamar o fornecedor. */
  protected abstract doComplete(request: LlmRequest): Promise<LlmCompletion>;

  protected validate(request: LlmRequest): void {
    if (request.messages.length === 0) {
      throw new AppError('BAD_REQUEST', 'A conversa enviada ao modelo está vazia.');
    }
  }
}
