import type { EngineLogger, SttRequest } from '../../../ports/engines.ts';
import { BaseSttEngine, type SttTranscription } from '../base/BaseSttEngine.ts';

export interface FakeSttOptions {
  /** Texto devolvido, ou uma função do pedido. */
  text?: string | ((request: SttRequest) => string);
  delayMs?: number;
  failWith?: Error;
}

/** Transcrição falsa: roda sem chave de API, nos testes e com STT_ENGINE=fake. */
export class FakeSttEngine extends BaseSttEngine {
  readonly name = 'fake';
  readonly calls: SttRequest[] = [];

  constructor(
    logger: EngineLogger,
    readonly options: FakeSttOptions = {},
  ) {
    super(logger);
  }

  protected async doTranscribe(request: SttRequest): Promise<SttTranscription> {
    this.calls.push(request);
    if (this.options.delayMs) await new Promise((r) => setTimeout(r, this.options.delayMs));
    if (this.options.failWith) throw this.options.failWith;
    const { text } = this.options;
    const out = typeof text === 'function' ? text(request) : (text ?? 'Esta é uma resposta transcrita de teste.');
    return { text: out, model: 'fake-stt-1' };
  }
}
