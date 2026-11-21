import { AppError } from '../domain/errors.ts';
import type { LlmEngine, SttEngine, TtsEngine } from '../ports/engines.ts';

/** Entrega o motor pelo nome gravado na entrevista. */
export interface EngineResolver<T> {
  defaultName(): string;
  get(name: string): T;
}

export type LlmResolver = EngineResolver<LlmEngine>;
export type SttResolver = EngineResolver<SttEngine>;
export type TtsResolver = EngineResolver<TtsEngine>;

/** Cria cada motor uma vez por nome. Motores não guardam estado de conversa. */
export class CachedEngineResolver<T> implements EngineResolver<T> {
  private readonly cache = new Map<string, T>();

  constructor(
    private readonly create: (name: string) => T,
    private readonly defaultEngine: string,
  ) {}

  defaultName() {
    return this.defaultEngine;
  }

  get(name: string) {
    let engine = this.cache.get(name);
    if (!engine) {
      try {
        engine = this.create(name);
      } catch (err) {
        // Motor gravado na entrevista que não existe mais ou está sem configuração.
        throw new AppError('ENGINE_FAILURE', `O motor "${name}" desta entrevista não está disponível: ${(err as Error).message}`, {
          cause: err,
        });
      }
      this.cache.set(name, engine);
    }
    return engine;
  }
}

/** Mantido por compatibilidade com o código da etapa 1. */
export const CachedLlmResolver = CachedEngineResolver<LlmEngine>;
