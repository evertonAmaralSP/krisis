import { describe, expect, it, vi } from 'vitest';
import { computeTimings } from '../src/application/feedback/timings.ts';
import { formatTranscript } from '../src/application/feedback/prompt.ts';
import type { Message } from '../src/domain/types.ts';
import { OpenAiCompatibleLlmEngine } from '../src/infra/engines/openai-compatible/OpenAiCompatibleLlmEngine.ts';

const msg = (author: Message['author'], t: Partial<Message['timings']>): Message => ({
  id: Math.random().toString(),
  interviewId: 'i',
  author,
  content: 'x',
  inputMode: author === 'candidate' ? 'voice' : null,
  audioSeconds: null,
  timings: { sttMs: null, llmMs: null, ttsMs: null, ...t },
  createdAt: new Date(),
});

describe('computeTimings', () => {
  it('média e pior caso por etapa; "até o texto" soma transcrição e modelo de cada turno', () => {
    const t = computeTimings([
      msg('interviewer', { llmMs: 600, ttsMs: 800 }),
      msg('candidate', { sttMs: 400 }),
      msg('interviewer', { llmMs: 300, ttsMs: 1200 }),
      msg('candidate', { sttMs: 600 }),
      msg('interviewer', { llmMs: 500 }),
    ]);
    const by = Object.fromEntries(t.map((s) => [s.stage, s]));
    expect(by.stt).toEqual({ stage: 'stt', count: 2, avgMs: 500, maxMs: 600 });
    expect(by.llm).toEqual({ stage: 'llm', count: 3, avgMs: 467, maxMs: 600 });
    expect(by.tts).toEqual({ stage: 'tts', count: 2, avgMs: 1000, maxMs: 1200 });
    expect(by.text).toEqual({ stage: 'text', count: 2, avgMs: 900, maxMs: 1100 });
  });

  it('sem dados, média e pior caso ficam nulos', () => {
    expect(computeTimings([])[0]).toEqual({ stage: 'stt', count: 0, avgMs: null, maxMs: null });
  });
});

describe('OpenAiCompatibleLlmEngine com saída estruturada', () => {
  it('envia response_format json_schema strict, o modelo e o raciocínio do pedido', async () => {
    const fetchFn = vi.fn(async () => Response.json({ model: 'grande', choices: [{ message: { content: '{}' } }] }));
    const engine = new OpenAiCompatibleLlmEngine(
      { name: 'groq', baseUrl: 'https://x/v1', apiKey: 'k', model: 'pequeno', maxTokens: 100, timeoutMs: 5000, reasoningEffort: 'low', fetchFn },
      { info: vi.fn(), error: vi.fn() },
    );
    await engine.complete({
      messages: [{ role: 'user', content: 'oi' }],
      model: 'grande',
      reasoningEffort: 'medium',
      maxTokens: 4096,
      jsonSchema: { name: 'fb', schema: { type: 'object' } },
    });
    const body = JSON.parse((fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({
      model: 'grande',
      reasoning_effort: 'medium',
      max_completion_tokens: 4096,
      response_format: { type: 'json_schema', json_schema: { name: 'fb', strict: true, schema: { type: 'object' } } },
    });
  });
});

describe('formatTranscript', () => {
  const m = (author: Message['author'], content: string): Message => ({ ...msg(author, {}), content });

  it('pareia cada pergunta com a resposta que veio logo depois e marca a última sem resposta', () => {
    const text = formatTranscript([
      m('interviewer', 'Fale de um projeto.'),
      m('candidate', 'Migrei para streaming.'),
      m('interviewer', 'Qual foi o desafio?'),
      m('candidate', 'Evitar duplicatas.'),
      m('interviewer', 'Como mediu?'),
    ]);
    expect(text).toContain('[1] PERGUNTA DO ENTREVISTADOR: Fale de um projeto.\n[1] RESPOSTA DO CANDIDATO: Migrei para streaming.');
    expect(text).toContain('[2] PERGUNTA DO ENTREVISTADOR: Qual foi o desafio?\n[2] RESPOSTA DO CANDIDATO: Evitar duplicatas.');
    expect(text).toContain('[3] PERGUNTA DO ENTREVISTADOR: Como mediu?\n[3] RESPOSTA DO CANDIDATO: (sem resposta');
  });
});

describe('OpenAiCompatibleLlmEngine: resposta cortada', () => {
  it('finish_reason "length" vira erro claro sobre o limite de tokens', async () => {
    const fetchFn = vi.fn(async () => Response.json({ choices: [{ message: { content: '{"summ' }, finish_reason: 'length' }] }));
    const engine = new OpenAiCompatibleLlmEngine(
      { name: 'groq', baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', maxTokens: 10, timeoutMs: 5000, fetchFn },
      { info: vi.fn(), error: vi.fn() },
    );
    const err = await engine.complete({ messages: [{ role: 'user', content: 'oi' }] }).catch((e) => e);
    expect(err.code).toBe('ENGINE_FAILURE');
    expect(err.message).toContain('limite de tokens');
  });
});
