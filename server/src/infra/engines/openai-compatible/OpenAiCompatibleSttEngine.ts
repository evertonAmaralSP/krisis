import type { EngineLogger, SttRequest } from '../../../ports/engines.ts';
import { BaseSttEngine, type SttTranscription } from '../base/BaseSttEngine.ts';

export interface OpenAiCompatibleSttOptions {
  /** Nome do motor no registro (ex.: "groq"). */
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** ISO-639-1 (ex.: "pt"). */
  language: string;
  timeoutMs: number;
  fetchFn?: typeof fetch;
}

/** Extensão que o fornecedor usa para reconhecer o formato do arquivo. */
export function extensionFor(mimeType: string): string {
  const base = mimeType.split(';')[0]!.trim().toLowerCase();
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'video/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'mp4',
    'video/mp4': 'mp4',
    'audio/x-m4a': 'm4a',
    'audio/m4a': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/wave': 'wav',
    'audio/flac': 'flac',
    'audio/x-flac': 'flac',
  };
  return map[base] ?? 'webm';
}

/**
 * Endpoint /audio/transcriptions no formato da OpenAI (Groq hoje).
 * Envia o arquivo como o navegador gravou, sem conversão: o fornecedor
 * já reduz para 16 kHz mono. Resposta `json` simples: só o texto.
 */
export class OpenAiCompatibleSttEngine extends BaseSttEngine {
  readonly name: string;
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly options: OpenAiCompatibleSttOptions,
    logger: EngineLogger,
  ) {
    super(logger);
    this.name = options.name;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  protected async doTranscribe(request: SttRequest): Promise<SttTranscription> {
    const { baseUrl, apiKey, model, language, timeoutMs } = this.options;
    const form = new FormData();
    const type = request.mimeType.split(';')[0]!;
    form.append('file', new Blob([new Uint8Array(request.audio)], { type }), `fala.${extensionFor(request.mimeType)}`);
    form.append('model', model);
    form.append('language', language);
    form.append('response_format', 'json');
    form.append('temperature', '0');
    if (request.prompt) form.append('prompt', request.prompt);

    const res = await this.fetchFn(`${baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} em ${this.name}: ${body.slice(0, 500)}`);
    }
    const data = (await res.json()) as { text?: string };
    return { text: data.text ?? '', model };
  }
}
