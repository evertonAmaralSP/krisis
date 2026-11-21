import type { AppConfig } from '../../config.ts';
import type { EngineLogger, LlmEngine } from '../../ports/engines.ts';
import { FakeLlmEngine } from './fake/FakeLlmEngine.ts';
import { OpenAiCompatibleLlmEngine } from './openai-compatible/OpenAiCompatibleLlmEngine.ts';

export interface EngineContext {
  config: AppConfig;
  logger: EngineLogger;
}

type Builder<T> = (ctx: EngineContext) => T;

/**
 * Registro nome → construtor de motor. Um motor novo = uma classe que
 * estende a base do seu tipo + uma linha de `register*`.
 * Transcrição e voz entram aqui nas etapas 2 e 3.
 */
export class EngineFactory {
  private readonly llm = new Map<string, Builder<LlmEngine>>();

  constructor(private readonly ctx: EngineContext) {}

  registerLlm(name: string, builder: Builder<LlmEngine>): this {
    this.llm.set(name, builder);
    return this;
  }

  llmNames(): string[] {
    return [...this.llm.keys()];
  }

  createLlm(name = this.ctx.config.llm.engine): LlmEngine {
    const builder = this.llm.get(name);
    if (!builder) {
      throw new Error(`LLM_ENGINE "${name}" desconhecido. Disponíveis: ${this.llmNames().join(', ')}.`);
    }
    return builder(this.ctx);
  }
}

export function defaultEngineFactory(ctx: EngineContext): EngineFactory {
  return new EngineFactory(ctx)
    .registerLlm('groq', ({ config, logger }) => {
      if (!config.groq.apiKey) throw new Error('GROQ_API_KEY não definida no .env.');
      return new OpenAiCompatibleLlmEngine(
        {
          name: 'groq',
          baseUrl: config.groq.baseUrl,
          apiKey: config.groq.apiKey,
          model: config.llm.model,
          maxTokens: config.llm.maxTokens,
          timeoutMs: config.llm.timeoutMs,
          reasoningEffort: config.llm.reasoningEffort,
        },
        logger,
      );
    })
    .registerLlm('fake', ({ logger }) => new FakeLlmEngine(logger));
}
