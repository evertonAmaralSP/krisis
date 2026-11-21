import type { LlmEngine } from '../ports/engines.ts';

/** Entrega o motor de linguagem pelo nome gravado na entrevista. */
export interface LlmResolver {
  defaultName(): string;
  get(name: string): LlmEngine;
}

/** Cria cada motor uma vez por nome. Motores não guardam estado de conversa. */
export class CachedLlmResolver implements LlmResolver {
  private readonly cache = new Map<string, LlmEngine>();

  constructor(
    private readonly create: (name: string) => LlmEngine,
    private readonly defaultEngine: string,
  ) {}

  defaultName() {
    return this.defaultEngine;
  }

  get(name: string) {
    let engine = this.cache.get(name);
    if (!engine) {
      engine = this.create(name);
      this.cache.set(name, engine);
    }
    return engine;
  }
}
