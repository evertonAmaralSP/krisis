import type { EngineLogger, TtsRequest } from '../../../ports/engines.ts';
import { BaseTtsEngine, type TtsAudio } from '../base/BaseTtsEngine.ts';

/** WAV válido de 0,1 s de silêncio (24 kHz, 16 bits, mono). */
export function silentWav(seconds = 0.1, sampleRate = 24_000): Buffer {
  const samples = Math.round(seconds * sampleRate);
  const data = samples * 2;
  const b = Buffer.alloc(44 + data);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + data, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(1, 22); // mono
  b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(data, 40);
  return b;
}

export interface FakeTtsOptions {
  delayMs?: number;
  failWith?: Error;
}

/** Voz falsa: roda sem o serviço Kokoro, nos testes e com TTS_ENGINE=fake. */
export class FakeTtsEngine extends BaseTtsEngine {
  readonly name = 'fake';
  readonly calls: TtsRequest[] = [];

  constructor(
    logger: EngineLogger,
    readonly options: FakeTtsOptions = {},
  ) {
    super(logger);
  }

  protected async doSynthesize(request: TtsRequest): Promise<TtsAudio> {
    this.calls.push(request);
    if (this.options.delayMs) await new Promise((r) => setTimeout(r, this.options.delayMs));
    if (this.options.failWith) throw this.options.failWith;
    return { audio: silentWav(), mimeType: 'audio/wav' };
  }
}
