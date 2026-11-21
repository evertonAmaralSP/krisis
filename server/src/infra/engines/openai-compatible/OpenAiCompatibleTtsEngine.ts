import type { EngineLogger, TtsRequest, TtsResult } from '../../../ports/engines.ts';
import { BaseTtsEngine, type TtsAudio } from '../base/BaseTtsEngine.ts';

export interface OpenAiCompatibleTtsOptions {
  /** Nome do motor no registro (ex.: "kokoro"). */
  name: string;
  baseUrl: string;
  /** Opcional: o serviço local do Kokoro não exige chave. */
  apiKey?: string | undefined;
  model: string;
  voice: string;
  speed: number;
  format: 'wav' | 'mp3' | 'opus';
  timeoutMs: number;
  fetchFn?: typeof fetch;
}

const MIME: Record<OpenAiCompatibleTtsOptions['format'], TtsResult['mimeType']> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  opus: 'audio/ogg',
};

/**
 * Endpoint /audio/speech no formato da OpenAI. Hoje: o serviço local
 * tts-kokoro/ (WAV). Serve também ao Kokoro-FastAPI ou a outro fornecedor
 * com o mesmo formato, mudando só a configuração.
 */
export class OpenAiCompatibleTtsEngine extends BaseTtsEngine {
  readonly name: string;
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly options: OpenAiCompatibleTtsOptions,
    logger: EngineLogger,
  ) {
    super(logger);
    this.name = options.name;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  protected async doSynthesize(request: TtsRequest): Promise<TtsAudio> {
    const { baseUrl, apiKey, model, voice, speed, format, timeoutMs } = this.options;
    const res = await this.fetchFn(`${baseUrl.replace(/\/$/, '')}/audio/speech`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(apiKey && { authorization: `Bearer ${apiKey}` }) },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({ model, input: request.text, voice, response_format: format, speed }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} em ${this.name}: ${body.slice(0, 500)}`);
    }
    return { audio: Buffer.from(await res.arrayBuffer()), mimeType: MIME[format] };
  }
}
