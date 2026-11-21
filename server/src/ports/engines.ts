/**
 * Portas dos motores. Cada motor concreto estende a classe base do seu tipo
 * (infra/engines/base), que implementa o roteiro comum (template method).
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResult {
  text: string;
  model: string;
  engine: string;
  ms: number;
}

export interface LlmEngine {
  readonly name: string;
  complete(request: LlmRequest): Promise<LlmResult>;
}

export interface SttRequest {
  audio: Buffer;
  mimeType: string;
  language?: string;
}

export interface SttResult {
  text: string;
  model: string;
  engine: string;
  ms: number;
  audioSeconds: number | null;
}

export interface SttEngine {
  readonly name: string;
  transcribe(request: SttRequest): Promise<SttResult>;
}

export interface TtsRequest {
  text: string;
}

export interface TtsResult {
  audio: Buffer;
  mimeType: 'audio/wav' | 'audio/mpeg' | 'audio/ogg' | 'audio/mp4';
  engine: string;
  ms: number;
}

export interface TtsEngine {
  readonly name: string;
  synthesize(request: TtsRequest): Promise<TtsResult>;
}

/** Logger mínimo que os motores usam para registrar os tempos. */
export interface EngineLogger {
  info(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
}
