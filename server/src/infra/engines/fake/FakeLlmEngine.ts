import type { EngineLogger, LlmRequest } from '../../../ports/engines.ts';
import { BaseLlmEngine, type LlmCompletion } from '../base/BaseLlmEngine.ts';

export interface FakeLlmOptions {
  /** Respostas em sequência, ou uma função da conversa. */
  replies?: string[] | ((request: LlmRequest) => string);
  delayMs?: number;
  /** Se definido, toda chamada falha com este erro. */
  failWith?: Error;
}

/** Motor falso: roda sem chave de API, nos testes e com LLM_ENGINE=fake. */
export class FakeLlmEngine extends BaseLlmEngine {
  readonly name = 'fake';
  readonly calls: LlmRequest[] = [];
  private index = 0;

  constructor(
    logger: EngineLogger,
    private readonly options: FakeLlmOptions = {},
  ) {
    super(logger);
  }

  protected async doComplete(request: LlmRequest): Promise<LlmCompletion> {
    this.calls.push(request);
    if (this.options.delayMs) await new Promise((r) => setTimeout(r, this.options.delayMs));
    if (this.options.failWith) throw this.options.failWith;
    const { replies } = this.options;
    let text: string;
    if (typeof replies === 'function') text = replies(request);
    else if (replies?.length) text = replies[Math.min(this.index, replies.length - 1)]!;
    else {
      const turns = request.messages.filter((m) => m.role === 'user').length;
      text = `Pergunta de teste ${turns + 1}: pode me contar mais sobre isso?`;
    }
    this.index += 1;
    return { text, model: 'fake-1' };
  }
}
