import { EngineError } from '../../../domain/errors.ts';
import type { EngineLogger, LlmRequest } from '../../../ports/engines.ts';
import { BaseLlmEngine, type LlmCompletion } from '../base/BaseLlmEngine.ts';

export interface OpenAiCompatibleOptions {
  /** Nome do motor no registro (ex.: "groq"). */
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  /** Só para modelos com raciocínio. */
  reasoningEffort?: 'low' | 'medium' | 'high' | undefined;
  fetchFn?: typeof fetch;
}

/**
 * Qualquer fornecedor com o endpoint /chat/completions no formato da OpenAI
 * (Groq hoje; Gemini oferece o mesmo formato). Usa fetch direto em vez do SDK:
 * o formato HTTP é estável e evita acoplamento a versões do pacote.
 */
export class OpenAiCompatibleLlmEngine extends BaseLlmEngine {
  readonly name: string;
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly options: OpenAiCompatibleOptions,
    logger: EngineLogger,
  ) {
    super(logger);
    this.name = options.name;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  protected async doComplete(request: LlmRequest): Promise<LlmCompletion> {
    const { baseUrl, apiKey, maxTokens } = this.options;
    const timeoutMs = request.timeoutMs ?? this.options.timeoutMs;
    const model = request.model ?? this.options.model;
    const reasoningEffort = request.reasoningEffort ?? this.options.reasoningEffort;
    const res = await this.fetchFn(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        messages: request.messages,
        max_completion_tokens: request.maxTokens ?? maxTokens,
        ...(request.temperature !== undefined && { temperature: request.temperature }),
        ...(reasoningEffort && { reasoning_effort: reasoningEffort }),
        ...(request.jsonSchema && {
          response_format: {
            type: 'json_schema',
            json_schema: { name: request.jsonSchema.name, strict: true, schema: request.jsonSchema.schema },
          },
        }),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} em ${this.name}: ${body.slice(0, 500)}`);
    }
    const data = (await res.json()) as {
      model?: string;
      choices?: { message?: { content?: string | null }; finish_reason?: string }[];
    };
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'length') {
      // O raciocínio conta no limite: a resposta foi cortada e não adianta repetir igual.
      throw new EngineError(
        this.name,
        'llm',
        'A resposta do modelo foi cortada pelo limite de tokens. Aumente o limite (LLM_MAX_TOKENS ou FEEDBACK_MAX_TOKENS).',
      );
    }
    return { text: choice?.message?.content ?? '', model: data.model ?? model };
  }
}
