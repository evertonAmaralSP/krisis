import type { v1 } from '@krisis/contracts';
import type { Message } from '../../domain/types.ts';

export type TimingStage = v1.TimingStage;
export type TimingStat = v1.TimingStat;

const stat = (stage: TimingStage, values: number[]): TimingStat => ({
  stage,
  count: values.length,
  avgMs: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null,
  maxMs: values.length ? Math.max(...values) : null,
});

/**
 * Tempos por etapa da entrevista, calculados das mensagens (nada a mais é guardado).
 * - stt: transcrição das falas por voz
 * - llm: resposta do modelo (inclui a primeira pergunta)
 * - tts: síntese do primeiro trecho de voz de cada resposta
 * - text: até o texto do entrevistador aparecer = transcrição + modelo de cada turno
 */
export function computeTimings(messages: Message[]): TimingStat[] {
  const stt: number[] = [];
  const llm: number[] = [];
  const tts: number[] = [];
  const text: number[] = [];

  messages.forEach((m, i) => {
    if (m.author === 'candidate') {
      if (m.timings.sttMs !== null) stt.push(m.timings.sttMs);
      const reply = messages[i + 1];
      if (reply?.author === 'interviewer' && reply.timings.llmMs !== null) {
        text.push((m.timings.sttMs ?? 0) + reply.timings.llmMs);
      }
    } else {
      if (m.timings.llmMs !== null) llm.push(m.timings.llmMs);
      if (m.timings.ttsMs !== null) tts.push(m.timings.ttsMs);
    }
  });

  return [stat('stt', stt), stat('llm', llm), stat('tts', tts), stat('text', text)];
}
