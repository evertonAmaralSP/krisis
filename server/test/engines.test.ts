import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.ts';
import { AppError, EngineError } from '../src/domain/errors.ts';
import { BaseLlmEngine } from '../src/infra/engines/base/BaseLlmEngine.ts';
import { EngineFactory, defaultEngineFactory } from '../src/infra/engines/EngineFactory.ts';
import { FakeLlmEngine } from '../src/infra/engines/fake/FakeLlmEngine.ts';
import { OpenAiCompatibleLlmEngine } from '../src/infra/engines/openai-compatible/OpenAiCompatibleLlmEngine.ts';

const logger = () => ({ info: vi.fn(), error: vi.fn() });
const conversa = [{ role: 'user' as const, content: 'Oi' }];

describe('BaseLlmEngine (template method)', () => {
  it('mede o tempo, registra no log e devolve o texto aparado', async () => {
    const log = logger();
    const engine = new FakeLlmEngine(log, { replies: ['  Primeira pergunta?  '], delayMs: 20 });
    const r = await engine.complete({ messages: conversa });
    expect(r).toMatchObject({ text: 'Primeira pergunta?', engine: 'fake', model: 'fake-1' });
    expect(r.ms).toBeGreaterThanOrEqual(15);
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'llm', engine: 'fake', ms: r.ms }),
      'llm concluído',
    );
  });

  it('padroniza qualquer falha do fornecedor como EngineError e registra', async () => {
    const log = logger();
    const engine = new FakeLlmEngine(log, { failWith: new Error('timeout do fornecedor') });
    const err = await engine.complete({ messages: conversa }).catch((e) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect(err).toMatchObject({ code: 'ENGINE_FAILURE', engine: 'fake', stage: 'llm' });
    expect(err.cause).toBeInstanceOf(Error);
    expect(log.error).toHaveBeenCalled();
  });

  it('recusa resposta vazia', async () => {
    const engine = new FakeLlmEngine(logger(), { replies: ['   '] });
    await expect(engine.complete({ messages: conversa })).rejects.toBeInstanceOf(EngineError);
  });

  it('recusa conversa vazia antes de chamar o fornecedor', async () => {
    const engine = new FakeLlmEngine(logger());
    await expect(engine.complete({ messages: [] })).rejects.toBeInstanceOf(AppError);
    expect(engine.calls).toHaveLength(0);
  });

  it('um motor novo só precisa implementar doComplete', async () => {
    class EcoEngine extends BaseLlmEngine {
      readonly name = 'eco';
      protected async doComplete() {
        return { text: 'eco', model: 'eco-1' };
      }
    }
    const r = await new EcoEngine(logger()).complete({ messages: conversa });
    expect(r).toMatchObject({ text: 'eco', engine: 'eco' });
  });
});

describe('OpenAiCompatibleLlmEngine', () => {
  const options = {
    name: 'groq',
    baseUrl: 'https://api.exemplo.com/openai/v1/',
    apiKey: 'chave-falsa',
    model: 'modelo-x',
    maxTokens: 300,
    timeoutMs: 5_000,
    reasoningEffort: 'low' as const,
  };

  it('envia o formato /chat/completions e lê a resposta', async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ model: 'modelo-x', choices: [{ message: { content: 'Olá!' } }] }),
    );
    const engine = new OpenAiCompatibleLlmEngine({ ...options, fetchFn }, logger());
    const r = await engine.complete({ messages: conversa });

    expect(r).toMatchObject({ text: 'Olá!', model: 'modelo-x', engine: 'groq' });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.exemplo.com/openai/v1/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer chave-falsa');
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'modelo-x',
      messages: conversa,
      max_completion_tokens: 300,
      reasoning_effort: 'low',
    });
  });

  it('transforma erro HTTP em EngineError', async () => {
    const fetchFn = vi.fn(async () => new Response('limite excedido', { status: 429 }));
    const engine = new OpenAiCompatibleLlmEngine({ ...options, fetchFn }, logger());
    const err = await engine.complete({ messages: conversa }).catch((e) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect(String(err.cause)).toContain('429');
  });
});

describe('EngineFactory', () => {
  const ctx = (env: Record<string, string> = {}) => ({
    config: loadConfig({ NODE_ENV: 'test', ...env }),
    logger: logger(),
  });

  it('cria o motor registrado pelo nome', () => {
    expect(defaultEngineFactory(ctx()).createLlm('fake')).toBeInstanceOf(FakeLlmEngine);
  });

  it('usa LLM_ENGINE como padrão', () => {
    expect(defaultEngineFactory(ctx({ LLM_ENGINE: 'fake' })).createLlm().name).toBe('fake');
  });

  it('explica quando o motor não existe', () => {
    expect(() => defaultEngineFactory(ctx()).createLlm('inexistente')).toThrow(/Disponíveis: groq, fake/);
  });

  it('exige GROQ_API_KEY para o groq', () => {
    expect(() => defaultEngineFactory(ctx()).createLlm('groq')).toThrow(/GROQ_API_KEY/);
    const groq = defaultEngineFactory(ctx({ GROQ_API_KEY: 'x' })).createLlm('groq');
    expect(groq).toBeInstanceOf(OpenAiCompatibleLlmEngine);
  });

  it('aceita motores novos sem alterar os existentes', () => {
    const f = new EngineFactory(ctx()).registerLlm('outro', ({ logger: l }) => new FakeLlmEngine(l));
    expect(f.llmNames()).toEqual(['outro']);
  });
});
