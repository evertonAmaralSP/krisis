import type { AppConfig } from '../../config.ts';
import type { EngineLogger, LlmEngine, SttEngine, TtsEngine } from '../../ports/engines.ts';
import { FakeLlmEngine } from './fake/FakeLlmEngine.ts';
import { FakeSttEngine } from './fake/FakeSttEngine.ts';
import { FakeTtsEngine } from './fake/FakeTtsEngine.ts';
import { OpenAiCompatibleLlmEngine } from './openai-compatible/OpenAiCompatibleLlmEngine.ts';
import { OpenAiCompatibleSttEngine } from './openai-compatible/OpenAiCompatibleSttEngine.ts';
import { OpenAiCompatibleTtsEngine } from './openai-compatible/OpenAiCompatibleTtsEngine.ts';

export interface EngineContext {
  config: AppConfig;
  logger: EngineLogger;
}

type Builder<T> = (ctx: EngineContext) => T;

/** Registro nome → construtor, para um tipo de motor. */
class Registry<T> {
  private readonly builders = new Map<string, Builder<T>>();

  constructor(private readonly envVar: string) {}

  register(name: string, builder: Builder<T>) {
    this.builders.set(name, builder);
  }

  names() {
    return [...this.builders.keys()];
  }

  create(name: string, ctx: EngineContext): T {
    const builder = this.builders.get(name);
    if (!builder) {
      throw new Error(`${this.envVar} "${name}" desconhecido. Disponíveis: ${this.names().join(', ')}.`);
    }
    return builder(ctx);
  }
}

/**
 * Um motor novo = uma classe que estende a base do seu tipo + uma linha
 * de `register*`.
 */
export class EngineFactory {
  private readonly llm = new Registry<LlmEngine>('LLM_ENGINE');
  private readonly stt = new Registry<SttEngine>('STT_ENGINE');
  private readonly tts = new Registry<TtsEngine>('TTS_ENGINE');

  constructor(private readonly ctx: EngineContext) {}

  registerLlm(name: string, builder: Builder<LlmEngine>): this {
    this.llm.register(name, builder);
    return this;
  }

  registerStt(name: string, builder: Builder<SttEngine>): this {
    this.stt.register(name, builder);
    return this;
  }

  registerTts(name: string, builder: Builder<TtsEngine>): this {
    this.tts.register(name, builder);
    return this;
  }

  ttsNames(): string[] {
    return this.tts.names();
  }

  createTts(name = this.ctx.config.tts.engine): TtsEngine {
    return this.tts.create(name, this.ctx);
  }

  llmNames(): string[] {
    return this.llm.names();
  }

  sttNames(): string[] {
    return this.stt.names();
  }

  createLlm(name = this.ctx.config.llm.engine): LlmEngine {
    return this.llm.create(name, this.ctx);
  }

  createStt(name = this.ctx.config.stt.engine): SttEngine {
    return this.stt.create(name, this.ctx);
  }
}

const requireGroqKey = (config: AppConfig) => {
  if (!config.groq.apiKey) throw new Error('GROQ_API_KEY não definida no .env.');
  return config.groq.apiKey;
};

export function defaultEngineFactory(ctx: EngineContext): EngineFactory {
  return new EngineFactory(ctx)
    .registerLlm(
      'groq',
      ({ config, logger }) =>
        new OpenAiCompatibleLlmEngine(
          {
            name: 'groq',
            baseUrl: config.groq.baseUrl,
            apiKey: requireGroqKey(config),
            model: config.llm.model,
            maxTokens: config.llm.maxTokens,
            timeoutMs: config.llm.timeoutMs,
            reasoningEffort: config.llm.reasoningEffort,
          },
          logger,
        ),
    )
    .registerLlm('fake', ({ logger }) => new FakeLlmEngine(logger))
    .registerStt(
      'groq',
      ({ config, logger }) =>
        new OpenAiCompatibleSttEngine(
          {
            name: 'groq',
            baseUrl: config.groq.baseUrl,
            apiKey: requireGroqKey(config),
            model: config.stt.model,
            language: config.stt.language,
            timeoutMs: config.stt.timeoutMs,
          },
          logger,
        ),
    )
    .registerStt('fake', ({ logger }) => new FakeSttEngine(logger))
    .registerTts(
      'kokoro',
      ({ config, logger }) =>
        new OpenAiCompatibleTtsEngine(
          {
            name: 'kokoro',
            baseUrl: config.kokoro.baseUrl,
            model: config.tts.model,
            voice: config.tts.voice,
            speed: config.tts.speed,
            format: 'wav',
            timeoutMs: config.tts.timeoutMs,
          },
          logger,
        ),
    )
    .registerTts('fake', ({ logger }) => new FakeTtsEngine(logger));
}
